/**
 * Nome curto do banco pelo CODIGO_BANCO da Domínio (nunca pelo texto lido pela IA).
 * Fora da lista, usa a DESCRICAO_BANCO da Domínio, encurtada.
 */
const CURTOS: Record<string, string> = {
  '001': 'BB', '003': 'Banco da Amazônia', '004': 'BNB', '021': 'Banestes', '033': 'Santander', '036': 'Bradesco BBI',
  '037': 'Banpará', '041': 'Banrisul', '047': 'Banese', '070': 'BRB', '077': 'Inter', '084': 'Uniprime', '085': 'Ailos',
  '097': 'Credisis', '104': 'Caixa', '133': 'Cresol', '136': 'Unicred', '208': 'BTG', '212': 'Original', '237': 'Bradesco',
  '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6', '341': 'Itaú', '380': 'PicPay', '389': 'Mercantil',
  '403': 'Cora', '422': 'Safra', '536': 'Neon', '623': 'Pan', '633': 'Rendimento', '655': 'Votorantim', '707': 'Daycoval',
  '745': 'Citibank', '748': 'Sicredi', '756': 'Sicoob',
};
export function nomeCurtoDoBanco(codigo: string | null | undefined, descricao?: string | null): string {
  const c = (codigo ?? '').replace(/\D/g, '').padStart(3, '0');
  if (CURTOS[c]) return CURTOS[c];
  if (descricao) {
    const limpo = descricao.replace(/\b(S\.?\/?A\.?|BANCO|COOPERATIVO|MULTIPLO|MÚLTIPLO|LTDA|DE|DO|DA)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    return limpo ? limpo.split(' ').slice(0, 2).map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(' ') : descricao;
  }
  return codigo ? `Banco ${codigo}` : 'Banco';
}
/** Todos os apelidos de busca de um código (ex.: 341 → itau, itaú). */
export function apelidosDoBanco(codigo: string | null | undefined, descricao?: string | null): string[] {
  const curto = nomeCurtoDoBanco(codigo, descricao);
  const extras: Record<string, string[]> = { '001': ['banco do brasil', 'brasil'], '104': ['cef', 'caixa economica'], '260': ['nu'] };
  return [curto, ...(extras[(codigo ?? '').padStart(3, '0')] ?? [])];
}
