'use client';
import { PDFDocument } from 'pdf-lib';

/**
 * Junta as páginas num PDF único, comprimido antes do upload: cada página em
 * JPEG, no máximo 1700 px no lado maior (≈ A4 a 200 dpi), qualidade 0,72.
 */
export async function canvasParaJpeg(c: HTMLCanvasElement, ladoMax = 1700, qualidade = 0.72): Promise<Blob> {
  const escala = Math.min(1, ladoMax / Math.max(c.width, c.height));
  const alvo = document.createElement('canvas');
  alvo.width = Math.round(c.width * escala); alvo.height = Math.round(c.height * escala);
  const ctx = alvo.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, alvo.width, alvo.height);
  return new Promise((ok) => alvo.toBlob((b) => ok(b!), 'image/jpeg', qualidade));
}

export async function montarPdf(paginas: Blob[]): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (const p of paginas) {
    const img = await doc.embedJpg(new Uint8Array(await p.arrayBuffer()));
    // Largura de A4 em pontos; a altura segue a proporção da foto.
    const largura = 595;
    const altura = (img.height / img.width) * largura;
    const pag = doc.addPage([largura, altura]);
    pag.drawImage(img, { x: 0, y: 0, width: largura, height: altura });
  }
  const bytes = await doc.save({ useObjectStreams: true });
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}
