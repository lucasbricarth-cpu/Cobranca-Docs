/** Utilidades de texto: acentos, CNPJ, nomes de arquivo. */

export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
export function normalizarBusca(s: string): string {
  return semAcento(s).toLowerCase().trim();
}
/** Só dígitos. */
export function digitos(s: string): string { return (s || '').replace(/\D/g, ''); }

export function formatarCnpj(c: string): string {
  const d = digitos(c).padStart(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
/** '12.345.678/0001-90' → '12.345.678/****-90' (parcial, para o popup de empresa). */
export function cnpjParcial(c: string): string {
  const d = digitos(c).padStart(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/****-${d.slice(12)}`;
}
export function cnpjValido(c: string): boolean {
  const d = digitos(c);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, ch, i) => acc + Number(ch) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}
/** Todos os CNPJs válidos encontrados num texto (com ou sem máscara). */
export function extrairCnpjs(texto: string): string[] {
  const achados = new Set<string>();
  const re = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
  for (const m of texto.matchAll(re)) {
    const d = digitos(m[0]);
    if (cnpjValido(d)) achados.add(d);
  }
  return [...achados];
}

/** Nome seguro para download no Windows: sem barra, acento ou caractere proibido. */
export function nomeDeDownload(partes: string[], extensao: string): string {
  const limpo = partes
    .map((p) => semAcento(p).replace(/[^A-Za-z0-9-]+/g, '_').replace(/^[_-]+|[_-]+$/g, ''))
    .filter(Boolean)
    .join('_');
  const ext = extensao.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${limpo || 'documento'}.${ext || 'bin'}`;
}

/** Final de conta ou cartão: os 4 últimos dígitos. */
export function final4(s: string): string {
  const d = digitos(s);
  return d.slice(-4).padStart(Math.min(4, d.length), '0');
}

/** +55 DDD número a partir de ddd e fone soltos ou de um número livre. */
export function paraE164(ddd: string | null | undefined, fone: string | null | undefined): string | null {
  const d = digitos(`${ddd ?? ''}${fone ?? ''}`);
  if (!d) return null;
  let n = d;
  if (n.startsWith('55') && (n.length === 12 || n.length === 13)) n = n.slice(2);
  if (n.length === 10 || n.length === 11) return `55${n}`;
  return null;
}
