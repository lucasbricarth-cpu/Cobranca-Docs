'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Visualizador de PDF com pdf.js no navegador: mostra todas as páginas em
 * qualquer aparelho (o iPhone só exibe a 1ª página num iframe, e alguns
 * navegadores nem têm leitor). Carregado sob demanda de /public/pdfjs.
 */
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { url: string; isEvalSupported: boolean }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> } }> ; destroy: () => Promise<void> }> };
};

export function VisualizadorPdf({ url, titulo }: { url: string; titulo: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState(false);
  const [paginas, setPaginas] = useState(0);

  useEffect(() => {
    let cancelado = false;
    let destruir: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const pdfjs = (await import(/* webpackIgnore: true */ '/pdfjs/pdf.min.mjs' as string)) as PdfJs;
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
        destruir = () => doc.destroy();
        if (cancelado) return;
        setPaginas(doc.numPages);
        const el = caixa.current!;
        el.innerHTML = '';
        const largura = el.clientWidth || 320;
        for (let n = 1; n <= Math.min(doc.numPages, 30); n++) {
          const pag = await doc.getPage(n);
          const base = pag.getViewport({ scale: 1 });
          const escala = (largura / base.width) * (window.devicePixelRatio || 1);
          const vp = pag.getViewport({ scale: escala });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
          canvas.style.width = '100%'; canvas.style.display = 'block'; canvas.style.background = '#fff';
          canvas.setAttribute('aria-label', `${titulo}, página ${n}`);
          if (cancelado) return;
          el.appendChild(canvas);
          await pag.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        }
      } catch {
        if (!cancelado) setErro(true);
      }
    })();
    return () => { cancelado = true; destruir?.().catch(() => undefined); };
  }, [url, titulo]);

  if (erro) return <div className="vazio">Não foi possível mostrar o PDF aqui. Use “Baixar”.</div>;
  return (
    <div className="w-full">
      <div ref={caixa} className="flex flex-col gap-2" />
      {paginas > 30 && <div className="text-[12px] text-fg-3 p-2">Mostrando 30 de {paginas} páginas. Baixe para ver tudo.</div>}
    </div>
  );
}
