'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Check, RotateCcw, ArrowUp, ArrowDown, Trash2, AlertTriangle, ImagePlus } from 'lucide-react';
import { carregarOpenCv, detectarPapel, cortarEMelhorar } from './opencv';
import { avaliarQualidade, avisosDe, type Ponto, type Qualidade } from './qualidade';
import { canvasParaJpeg, montarPdf } from './pdf';

/**
 * Modo scanner no aparelho: detecta as bordas, corta, endireita e melhora o
 * contraste (OpenCV.js). Várias páginas viram um único PDF; dá para
 * reordenar, refazer ou excluir qualquer página. Avisa de foto tremida,
 * escura ou cortada antes de enviar. O PDF é comprimido antes do upload.
 */
interface Pagina { id: string; jpeg: Blob; url: string; qualidade: Qualidade }
const AVISO: Record<string, string> = { tremida: 'Tremida', escura: 'Escura', cortada: 'Cortada' };

export function Scanner({ aoConcluir, aoFechar, titulo }: { aoConcluir: (pdf: File) => void; aoFechar: () => void; titulo?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const sobre = useRef<HTMLCanvasElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const cvRef = useRef<unknown>(null);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [refazendo, setRefazendo] = useState<number | null>(null);
  const [revisar, setRevisar] = useState(false);
  const [semCamera, setSemCamera] = useState(false);
  const [cvPronto, setCvPronto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [ultimoAviso, setUltimoAviso] = useState<{ indice: number; avisos: string[] } | null>(null);

  // Câmera traseira; sem câmera (ou sem permissão), cai para escolher fotos da galeria.
  useEffect(() => {
    let parar = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (parar) { s.getTracks().forEach((t) => t.stop()); return; }
        fluxo.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => undefined); }
      } catch { setSemCamera(true); }
    })();
    carregarOpenCv().then((cv) => { cvRef.current = cv; setCvPronto(true); }).catch(() => undefined);
    return () => { parar = true; fluxo.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Contorno do papel ao vivo (a cada 400 ms, numa cópia reduzida do quadro).
  useEffect(() => {
    if (!cvPronto || semCamera) return;
    const reduzido = document.createElement('canvas');
    const t = setInterval(() => {
      const v = video.current, o = sobre.current;
      if (!v || !o || !v.videoWidth) return;
      const e = 480 / Math.max(v.videoWidth, v.videoHeight);
      reduzido.width = Math.round(v.videoWidth * e); reduzido.height = Math.round(v.videoHeight * e);
      reduzido.getContext('2d')!.drawImage(v, 0, 0, reduzido.width, reduzido.height);
      let quad: Ponto[] | null = null;
      try { quad = detectarPapel(cvRef.current, reduzido); } catch { /* quadro ruim */ }
      o.width = o.clientWidth; o.height = o.clientHeight;
      const ctx = o.getContext('2d')!;
      ctx.clearRect(0, 0, o.width, o.height);
      if (!quad) return;
      // object-fit: cover — converte coordenadas do vídeo para a tela.
      const esc = Math.max(o.width / reduzido.width, o.height / reduzido.height);
      const dx = (o.width - reduzido.width * esc) / 2, dy = (o.height - reduzido.height * esc) / 2;
      ctx.strokeStyle = '#C9A961'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(201,169,97,.12)';
      ctx.beginPath();
      quad.forEach((p, i) => (i ? ctx.lineTo(p.x * esc + dx, p.y * esc + dy) : ctx.moveTo(p.x * esc + dx, p.y * esc + dy)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }, 400);
    return () => clearInterval(t);
  }, [cvPronto, semCamera]);

  const processarQuadro = useCallback(async (origem: HTMLCanvasElement): Promise<Pagina> => {
    // Detecção numa cópia reduzida; corte no tamanho cheio.
    const red = document.createElement('canvas');
    const e = 800 / Math.max(origem.width, origem.height);
    red.width = Math.round(origem.width * e); red.height = Math.round(origem.height * e);
    red.getContext('2d')!.drawImage(origem, 0, 0, red.width, red.height);
    let quad: Ponto[] | null = null;
    const cv = cvRef.current;
    if (cv) { try { quad = detectarPapel(cv, red); } catch { quad = null; } }
    const qualidade = avaliarQualidade(red.getContext('2d')!.getImageData(0, 0, red.width, red.height), quad);
    const final = document.createElement('canvas');
    if (cv) {
      try { cortarEMelhorar(cv, origem, quad ? quad.map((p) => ({ x: p.x / e, y: p.y / e })) : null, final); }
      catch { final.width = origem.width; final.height = origem.height; final.getContext('2d')!.drawImage(origem, 0, 0); }
    } else { final.width = origem.width; final.height = origem.height; final.getContext('2d')!.drawImage(origem, 0, 0); }
    const jpeg = await canvasParaJpeg(final);
    return { id: crypto.randomUUID(), jpeg, url: URL.createObjectURL(jpeg), qualidade };
  }, []);

  const adicionar = useCallback((p: Pagina) => {
    setPaginas((atual) => {
      const novo = [...atual];
      const indice = refazendo ?? novo.length;
      if (refazendo !== null) { URL.revokeObjectURL(novo[refazendo].url); novo[refazendo] = p; } else novo.push(p);
      const avisos = avisosDe(p.qualidade);
      setUltimoAviso(avisos.length ? { indice, avisos } : null);
      return novo;
    });
    setRefazendo(null);
  }, [refazendo]);

  async function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth || ocupado) return;
    setOcupado(true);
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    adicionar(await processarQuadro(c));
    setOcupado(false);
    if (refazendo !== null) setRevisar(true);
  }

  async function daGaleria(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setOcupado(true);
    for (const f of Array.from(arquivos)) {
      const bmp = await createImageBitmap(f);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height; c.getContext('2d')!.drawImage(bmp, 0, 0);
      adicionar(await processarQuadro(c));
    }
    setOcupado(false);
  }

  async function concluir() {
    setOcupado(true);
    const pdf = await montarPdf(paginas.map((p) => p.jpeg));
    setOcupado(false);
    aoConcluir(new File([pdf], 'documento-escaneado.pdf', { type: 'application/pdf' }));
  }

  const mover = (i: number, d: -1 | 1) => setPaginas((a) => { const n = [...a]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const excluir = (i: number) => setPaginas((a) => { URL.revokeObjectURL(a[i].url); return a.filter((_, j) => j !== i); });
  const comAviso = paginas.map((p, i) => ({ i, avisos: avisosDe(p.qualidade) })).filter((x) => x.avisos.length);

  const tela = (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Escanear documento">
      <div className="scanner-topo">
        <button className="btn btn-ghost btn-icon" onClick={aoFechar} aria-label="Fechar"><X size={20} /></button>
        <span className="text-[14px] font-medium truncate">{revisar ? 'Revisar páginas' : refazendo !== null ? `Refazer a página ${refazendo + 1}` : titulo ?? 'Escanear documento'}</span>
        <span className="mono text-[12px] text-fg-3 ml-auto">{paginas.length} pág.</span>
      </div>

      {!revisar ? (
        <>
          <div className="scanner-video">
            {semCamera ? (
              <label className="vazio m-6 flex flex-col items-center gap-3 cursor-pointer">
                <ImagePlus size={28} />
                Não conseguimos abrir a câmera. Escolha as fotos do documento.
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => daGaleria(e.target.files)} />
              </label>
            ) : (
              <>
                <video ref={video} playsInline muted autoPlay />
                <canvas ref={sobre} className="scanner-contorno" />
                {!cvPronto && <span className="scanner-dica">Preparando o scanner…</span>}
              </>
            )}
          </div>
          {ultimoAviso && (
            <div className="scanner-aviso" role="alert">
              <AlertTriangle size={16} />
              <span className="flex-1">A página {ultimoAviso.indice + 1} ficou {ultimoAviso.avisos.map((a) => AVISO[a].toLowerCase()).join(' e ')}.</span>
              <button className="btn btn-sm" onClick={() => { setRefazendo(ultimoAviso.indice); setUltimoAviso(null); }}><RotateCcw size={13} />Refazer</button>
            </div>
          )}
          <div className="scanner-base">
            <div className="scanner-miniaturas">
              {paginas.map((p, i) => (
                <button key={p.id} className="scanner-mini" onClick={() => setRevisar(true)} aria-label={`Página ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" />
                  {avisosDe(p.qualidade).length > 0 && <span className="scanner-mini-aviso"><AlertTriangle size={11} /></span>}
                </button>
              ))}
            </div>
            <button className="scanner-disparo" onClick={capturar} disabled={semCamera || ocupado} aria-label="Fotografar página"><Camera size={26} /></button>
            <button className="btn btn-primary" disabled={!paginas.length || ocupado} onClick={() => setRevisar(true)}><Check size={16} />Concluir</button>
          </div>
        </>
      ) : (
        <div className="scanner-revisao">
          {comAviso.length > 0 && (
            <div className="scanner-aviso" role="alert">
              <AlertTriangle size={16} />
              <span>Antes de enviar: {comAviso.map((x) => `página ${x.i + 1} ${x.avisos.map((a) => AVISO[a].toLowerCase()).join(' e ')}`).join('; ')}.</span>
            </div>
          )}
          <div className="scanner-paginas">
            {paginas.map((p, i) => (
              <div key={p.id} className="scanner-pagina">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Página ${i + 1}`} />
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="mono text-[12px] mr-auto">Pág. {i + 1}</span>
                  {avisosDe(p.qualidade).map((a) => <span key={a} className="pill st-refazer">{AVISO[a]}</span>)}
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-sm btn-icon" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir página"><ArrowUp size={14} /></button>
                  <button className="btn btn-sm btn-icon" disabled={i === paginas.length - 1} onClick={() => mover(i, 1)} aria-label="Descer página"><ArrowDown size={14} /></button>
                  <button className="btn btn-sm" onClick={() => { setRefazendo(i); setRevisar(false); }}><RotateCcw size={13} />Refazer</button>
                  <button className="btn btn-sm btn-icon ml-auto" onClick={() => excluir(i)} aria-label="Excluir página"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="scanner-base">
            <button className="btn" onClick={() => setRevisar(false)}><Camera size={15} />Mais páginas</button>
            <button className="btn btn-primary ml-auto" disabled={!paginas.length || ocupado} onClick={concluir}><Check size={16} />{ocupado ? 'Montando PDF…' : `Usar ${paginas.length} página${paginas.length === 1 ? '' : 's'}`}</button>
          </div>
        </div>
      )}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(tela, document.body) : null;
}
