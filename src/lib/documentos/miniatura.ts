import { resolve } from 'node:path';
import sharp from 'sharp';

/**
 * Miniatura da primeira página, gerada UMA vez na fila (depois do
 * antivírus). A lista nunca abre o PDF inteiro. Tipos sensíveis não têm
 * miniatura (quem chama já não pede).
 */
export async function gerarMiniatura(dados: Buffer, familia: 'pdf' | 'imagem' | string): Promise<{ png: Buffer; paginas?: number } | null> {
  if (familia === 'imagem') {
    const png = await sharp(dados, { failOn: 'none' }).rotate().resize(240, 320, { fit: 'cover', position: 'top' }).webp({ quality: 70 }).toBuffer();
    return { png };
  }
  if (familia === 'pdf') {
    const canvasMod = await import('@napi-rs/canvas');
    const g = globalThis as Record<string, unknown>;
    g.Path2D ??= canvasMod.Path2D; g.DOMMatrix ??= canvasMod.DOMMatrix; g.ImageData ??= canvasMod.ImageData;
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(dados),
      standardFontDataUrl: resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts') + '/',
      isEvalSupported: false, disableFontFace: true, useSystemFonts: false,
    }).promise;
    try {
      const pag = await doc.getPage(1);
      const base = pag.getViewport({ scale: 1 });
      const vp = pag.getViewport({ scale: 480 / base.height });
      const canvas = canvasMod.createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pag.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise;
      const png = await sharp(canvas.toBuffer('image/png')).resize(240, 320, { fit: 'cover', position: 'top' }).webp({ quality: 70 }).toBuffer();
      return { png, paginas: doc.numPages };
    } finally {
      await doc.destroy();
    }
  }
  return null;
}
