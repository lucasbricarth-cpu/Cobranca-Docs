/**
 * Toda data e todo mês do app contam pelo fuso America/Sao_Paulo, nunca pelo
 * relógio do servidor (prompt §0). Competência = primeiro dia do mês, em
 * texto 'AAAA-MM-01', que o Postgres guarda como DATE.
 */
export const FUSO = 'America/Sao_Paulo';

const fmtData = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'AAAA-MM-DD' de um instante, no fuso de São Paulo. */
export function dataSP(instante: Date = new Date()): string {
  return fmtData.format(instante); // en-CA dá AAAA-MM-DD
}
export function hojeSP(): string { return dataSP(); }

/** Partes locais (ano, mês 1-12, dia) de um instante. */
export function partesSP(instante: Date = new Date()): { ano: number; mes: number; dia: number } {
  const [a, m, d] = dataSP(instante).split('-').map(Number);
  return { ano: a, mes: m, dia: d };
}

/** 'AAAA-MM-01' do mês em que o instante cai, em São Paulo. */
export function competenciaDoMes(instante: Date = new Date()): string {
  const { ano, mes } = partesSP(instante);
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}
/** Soma meses a uma competência 'AAAA-MM-01'. */
export function somarMeses(competencia: string, n: number): string {
  const [a, m] = competencia.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}
/** Regra de mês dos tipos para envio sem pedido: 'anterior' ou 'atual'. */
export function competenciaPelaRegra(regra: 'anterior' | 'atual', instante: Date = new Date()): string {
  const atual = competenciaDoMes(instante);
  return regra === 'anterior' ? somarMeses(atual, -1) : atual;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** 'Setembro 2026' */
export function nomeDoMes(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number);
  const nome = MESES[m - 1] ?? '';
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${a}`;
}
/** 'Set/2026' */
export function mesCurto(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number);
  return `${MESES_CURTOS[m - 1] ?? '?'}/${a}`;
}
/** 'setembro/2026' (minúsculo, para mensagens). */
export function mesPorExtenso(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number);
  return `${MESES[m - 1] ?? '?'}/${a}`;
}
/** '2026-09' (para nomes de download: o ano vem antes do mês). */
export function anoMes(competencia: string): string { return competencia.slice(0, 7); }

/** 'DD/MM' ou 'DD/MM/AAAA' de uma data 'AAAA-MM-DD' ou de um instante. */
export function dataCurta(d: string | Date, comAno = false): string {
  const s = typeof d === 'string' ? d.slice(0, 10) : dataSP(d);
  const [a, m, dia] = s.split('-');
  return comAno ? `${dia}/${m}/${a}` : `${dia}/${m}`;
}
/** Hora local 'HH:MM' de um instante. */
export function horaSP(instante: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(instante);
}

/** Interpreta nomes de mês em busca: 'setembro', 'set', 'set/2026', '09/2026', '2026-09'. */
export function reconhecerMes(texto: string, anoPadrao: number): string | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const iso = t.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-01`;
  const num = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (num) return `${num[2]}-${num[1].padStart(2, '0')}-01`;
  const nome = t.match(/^([a-z]{3,9})(?:\/(\d{4}))?$/);
  if (nome) {
    const i = MESES.findIndex((m) => m.normalize('NFD').replace(/[̀-ͯ]/g, '').startsWith(nome[1]));
    if (i >= 0 && nome[1].length >= 3) return `${nome[2] ?? anoPadrao}-${String(i + 1).padStart(2, '0')}-01`;
  }
  return null;
}

/** Diferença em dias entre duas datas 'AAAA-MM-DD' (b - a). */
export function diasEntre(a: string, b: string): number {
  const [a1, a2, a3] = a.split('-').map(Number);
  const [b1, b2, b3] = b.split('-').map(Number);
  return Math.round((Date.UTC(b1, b2 - 1, b3) - Date.UTC(a1, a2 - 1, a3)) / 86400000);
}
export function somarDias(data: string, n: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
