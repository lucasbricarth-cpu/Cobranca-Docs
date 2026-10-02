'use client';
import { ordenarCantos, type Ponto } from './qualidade';

/**
 * OpenCV.js, carregado só quando o cliente abre a câmera (de /opencv/opencv.js,
 * guardado pelo service worker). Detecta as bordas do papel, corta,
 * endireita e melhora o contraste. Se não carregar, a câmera funciona sem corte.
 */
let promessa: Promise<any> | null = null;
export function carregarOpenCv(): Promise<any> {
  if (promessa) return promessa;
  promessa = new Promise((ok, falha) => {
    const w = window as any;
    if (w.cv?.Mat) return ok(w.cv);
    const s = document.createElement('script');
    s.src = '/opencv/opencv.js';
    s.async = true;
    s.onload = async () => {
      try {
        // Conforme a versão, o opencv.js expõe o módulo pronto, uma Promise ou uma função
        // assíncrona que cria o módulo (builds MODULARIZE). Trata os três.
        let cv = w.cv;
        if (typeof cv === 'function' && !cv.Mat) cv = await cv();
        if (cv instanceof Promise) cv = await cv;
        if (!cv.Mat) await new Promise<void>((r) => { cv.onRuntimeInitialized = () => r(); });
        w.cv = cv;
        ok(cv);
      } catch (e) { falha(e); }
    };
    s.onerror = falha;
    document.head.appendChild(s);
  });
  return promessa;
}

/** Acha o maior quadrilátero (o papel) num canvas. Coordenadas no tamanho do canvas. */
export function detectarPapel(cv: any, canvas: HTMLCanvasElement): Ponto[] | null {
  const src = cv.imread(canvas);
  const gray = new cv.Mat(); const blur = new cv.Mat(); const edges = new cv.Mat();
  const contours = new cv.MatVector(); const hier = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 50, 150);
    const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, k); k.delete();
    cv.findContours(edges, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const areaMin = canvas.width * canvas.height * 0.15;
    let melhor: Ponto[] | null = null; let melhorArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      // Envoltória convexa: riscos e textos que encostam na borda do papel não atrapalham.
      const casca = new cv.Mat();
      cv.convexHull(c, casca, false, true);
      const area = cv.contourArea(casca);
      if (area > areaMin && area > melhorArea) {
        const peri = cv.arcLength(casca, true);
        // Simplifica aos poucos até sobrarem 4 cantos.
        for (const eps of [0.02, 0.03, 0.045, 0.06, 0.08]) {
          const approx = new cv.Mat();
          cv.approxPolyDP(casca, approx, eps * peri, true);
          if (approx.rows === 4) {
            const pts: Ponto[] = [];
            for (let j = 0; j < 4; j++) pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
            melhor = ordenarCantos(pts); melhorArea = area;
            approx.delete();
            break;
          }
          approx.delete();
        }
      }
      casca.delete(); c.delete();
    }
    return melhor;
  } finally {
    src.delete(); gray.delete(); blur.delete(); edges.delete(); contours.delete(); hier.delete();
  }
}

/** Corta e endireita o papel (perspectiva) e melhora o contraste (CLAHE na luminância). */
export function cortarEMelhorar(cv: any, origem: HTMLCanvasElement, quad: Ponto[] | null, destino: HTMLCanvasElement) {
  const src = cv.imread(origem);
  let out = src;
  try {
    if (quad) {
      const [tl, tr, br, bl] = quad;
      const d = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
      const W = Math.round(Math.max(d(tl, tr), d(bl, br)));
      const H = Math.round(Math.max(d(tl, bl), d(tr, br)));
      const de = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
      const para = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]);
      const M = cv.getPerspectiveTransform(de, para);
      out = new cv.Mat();
      cv.warpPerspective(src, out, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());
      de.delete(); para.delete(); M.delete();
    }
    // Contraste: CLAHE no canal L (Lab), mantendo as cores.
    const rgb = new cv.Mat(); const lab = new cv.Mat(); const canais = new cv.MatVector();
    cv.cvtColor(out, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    cv.split(lab, canais);
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    const l = canais.get(0); clahe.apply(l, l); canais.set(0, l);
    cv.merge(canais, lab);
    cv.cvtColor(lab, rgb, cv.COLOR_Lab2RGB);
    cv.imshow(destino, rgb);
    l.delete(); clahe.delete(); rgb.delete(); lab.delete(); canais.delete();
  } finally {
    if (out !== src) out.delete();
    src.delete();
  }
}
