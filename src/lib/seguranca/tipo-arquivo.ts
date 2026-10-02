import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';

/**
 * Confere o tipo REAL pelo conteúdo (assinatura dos bytes), não pela
 * extensão nem pelo tipo que o navegador declarou.
 */
export type TipoReal = { mime: string; extensao: string; familia: 'pdf' | 'imagem' | 'xml' | 'ofx' | 'planilha' | 'texto' };

export function detectarTipo(b: Buffer): TipoReal | null {
  const ini = (n: number) => b.subarray(0, n);
  if (b.length >= 5 && ini(5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', extensao: 'pdf', familia: 'pdf' };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', extensao: 'jpg', familia: 'imagem' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', extensao: 'png', familia: 'imagem' };
  if (b.length >= 12 && ini(4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', extensao: 'webp', familia: 'imagem' };
  if (b.length >= 12 && b.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|hevc|mif1|msf1|heif)$/.test(b.subarray(8, 12).toString('latin1'))) return { mime: 'image/heic', extensao: 'heic', familia: 'imagem' };
  // Texto: XML (NF-e), OFX (SGML ou XML), CSV.
  const cab = b.subarray(0, 2048).toString('utf8').replace(/^﻿/, '').trimStart();
  if (/^OFXHEADER:/i.test(cab) || (/^<\?xml/i.test(cab) && /<\?OFX|<OFX>/i.test(b.subarray(0, 4096).toString('utf8')))) return { mime: 'application/x-ofx', extensao: 'ofx', familia: 'ofx' };
  if (/^<\?xml/i.test(cab) || /^<(nfeProc|NFe|procEventoNFe|CTe|cteProc)\b/.test(cab)) return { mime: 'application/xml', extensao: 'xml', familia: 'xml' };
  // XLSX/DOCX são ZIP: aceitamos só XLSX (planilhas de extrato) conferindo o conteúdo.
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && b.includes(Buffer.from('xl/'))) {
    return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensao: 'xlsx', familia: 'planilha' };
  }
  if (ehTextoSimples(b) && /[;,]/.test(cab.split('\n')[0] ?? '')) return { mime: 'text/csv', extensao: 'csv', familia: 'texto' };
  return null;
}

function ehTextoSimples(b: Buffer): boolean {
  const amostra = b.subarray(0, 4096);
  for (const x of amostra) if (x === 0) return false;
  return true;
}

/**
 * PDF com JavaScript embutido é recusado. Duas checagens: os marcadores no
 * texto cru (cobre PDFs simples) e o catálogo lido pelo pdf-lib (cobre
 * /Names/JavaScript, /OpenAction e /AA mesmo dentro de streams de objeto).
 */
export async function pdfTemJavascript(b: Buffer): Promise<boolean> {
  const cru = b.toString('latin1');
  if (/\/JavaScript\b|\/JS\s*[(<\[]|\/JS\s+\d+\s+\d+\s+R/.test(cru)) return true;
  try {
    const doc = await PDFDocument.load(b, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    const cat = doc.catalog;
    const names = cat.lookupMaybe(PDFName.of('Names'), PDFDict);
    if (names?.lookupMaybe(PDFName.of('JavaScript'), PDFDict)) return true;
    const open = cat.get(PDFName.of('OpenAction'));
    if (open && /JavaScript/.test(String(doc.context.lookup(open)))) return true;
    if (cat.get(PDFName.of('AA'))) return true;
    for (const p of doc.getPages()) if (p.node.get(PDFName.of('AA'))) return true;
  } catch {
    // PDF que nem o pdf-lib abre: não dá para garantir; fica para conferência humana (não é JS confirmado).
  }
  return false;
}

export function limiteBytes(): number {
  return Number(process.env.LIMITE_ARQUIVO_MB ?? 25) * 1024 * 1024;
}
