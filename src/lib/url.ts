/** Monta "?a=1&b=2" a partir dos parâmetros atuais, trocando/apagando chaves (undefined/null apaga). */
export function comParametros(atuais: Record<string, string | string[] | undefined>, mudar: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(atuais)) if (typeof v === 'string' && !(k in mudar)) p.set(k, v);
  for (const [k, v] of Object.entries(mudar)) if (v !== null && v !== undefined && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '?';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Parâmetro de URL que deveria ser um id: o que não for UUID vira undefined (nunca chega ao banco). */
export function uuidOuNada(v: string | undefined | null): string | undefined {
  return v && UUID.test(v) ? v : undefined;
}
/** Lista de ids separados por vírgula, só os válidos. */
export function uuids(v: string | undefined | null): string[] {
  return (v ?? '').split(',').filter((x) => UUID.test(x));
}
