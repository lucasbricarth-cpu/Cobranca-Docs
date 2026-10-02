import { XMLParser } from 'fast-xml-parser';

/**
 * NF-e (XML), sem IA, de graça e exata: CNPJ do emitente e do destinatário,
 * número e data de emissão. Quem decide entrada/saída é o CNPJ da empresa.
 */
export interface LeituraNfe { emitente: string | null; destinatario: string | null; emissao: string | null; numero: string | null }

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, processEntities: false });

function achar(o: unknown, chave: string): unknown {
  if (!o || typeof o !== 'object') return undefined;
  const r = o as Record<string, unknown>;
  if (chave in r) return r[chave];
  for (const v of Object.values(r)) { const x = achar(v, chave); if (x !== undefined) return x; }
  return undefined;
}

export function lerNfe(dados: Buffer): LeituraNfe | null {
  let doc: unknown;
  try { doc = parser.parse(dados.toString('utf8')); } catch { return null; }
  const inf = achar(doc, 'infNFe');
  if (!inf) return null;
  const emit = achar(inf, 'emit') as Record<string, unknown> | undefined;
  const dest = achar(inf, 'dest') as Record<string, unknown> | undefined;
  const ide = achar(inf, 'ide') as Record<string, unknown> | undefined;
  const data = String(ide?.dhEmi ?? ide?.dEmi ?? '');
  const so = (v: unknown) => (v ? String(v).replace(/\D/g, '') : null);
  return {
    emitente: so(emit?.CNPJ), destinatario: so(dest?.CNPJ),
    // dhEmi já vem com o fuso (ex.: -03:00): a data local é a dos 10 primeiros caracteres.
    emissao: /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10) : null,
    numero: ide?.nNF ? String(ide.nNF) : null,
  };
}
