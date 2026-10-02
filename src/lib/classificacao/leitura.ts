import { resolve } from 'node:path';
import { extrairCnpjs } from '@/lib/texto';
import type { TipoReal } from '@/lib/seguranca/tipo-arquivo';

/** Texto das primeiras páginas de um PDF (para achar CNPJs sem IA). */
export async function textoDoPdf(dados: Buffer, maxPaginas = 3): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(dados), isEvalSupported: false, disableFontFace: true, useSystemFonts: false,
    standardFontDataUrl: resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts') + '/',
  }).promise;
  try {
    const partes: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, maxPaginas); n++) {
      const t = await (await doc.getPage(n)).getTextContent();
      partes.push(t.items.map((i) => ('str' in i ? i.str : '')).join(' '));
    }
    return partes.join('\n');
  } finally {
    await doc.destroy();
  }
}

/** CNPJs encontrados no conteúdo, sem IA (XML, OFX e PDF com texto). Foto só pela IA (Etapa 6). */
export async function cnpjsDoConteudo(dados: Buffer, tipo: TipoReal): Promise<string[]> {
  if (tipo.familia === 'xml' || tipo.familia === 'ofx' || tipo.familia === 'texto') return extrairCnpjs(dados.toString('utf8'));
  if (tipo.familia === 'pdf') {
    try { return extrairCnpjs(await textoDoPdf(dados)); } catch { return []; }
  }
  return [];
}
