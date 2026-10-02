import { CONSULTAS } from './consultas.ts';
import type { Conexao } from './conexao.ts';

export interface Lote {
  empresas: { codi_emp: number; nome: string; cnpj: string; email: string | null; situacao: string | null; simples: boolean | null; ddd: string | null; fone: string | null }[];
  contatos: { codi_emp: number; nome: string | null; email: string | null; telefone: string | null }[];
  responsaveis: { codi_emp: number; i_responsavel: number; tipo: string | null }[];
  contas: { codi_emp: number; i_conta_caixa: number; i_banco: number | null; agencia: string | null; identificador: string | null; codigo_banco: string | null; nome_banco: string | null }[];
  encerradas: { codi_emp: number; i_conta_caixa: number }[];
  diagnostico?: Record<string, unknown>;
}

const txt = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);
const num = (v: unknown) => Number(v);

/** Lê tudo o que o app usa. Só SELECT (a conexão já passa pela trava). */
export async function lerDominio(c: Conexao, opcoes: { diagnostico?: boolean; sqlEncerradas?: string } = {}): Promise<Lote> {
  const empresas = (await c.consultar<Record<string, unknown>>(CONSULTAS.empresas)).map((r) => ({
    codi_emp: num(r.codi_emp), nome: txt(r.nome_emp) ?? '', cnpj: (txt(r.cgce_emp) ?? '').replace(/\D/g, ''),
    email: txt(r.email_emp), situacao: txt(r.stat_emp),
    simples: r.simples_emp === null || r.simples_emp === undefined ? null : ['S', '1', 'true', 1, true].includes(r.simples_emp as never),
    ddd: txt(r.dddf_emp), fone: txt(r.fone_emp),
  }));
  const contatos = (await c.consultar<Record<string, unknown>>(CONSULTAS.contatos)).map((r) => ({
    codi_emp: num(r.codi_emp), nome: txt(r.nome_contato), email: txt(r.email_contato), telefone: txt(r.telefone_contato),
  }));
  const responsaveis = (await c.consultar<Record<string, unknown>>(CONSULTAS.responsaveis)).map((r) => ({
    codi_emp: num(r.codi_emp), i_responsavel: num(r.i_responsavel), tipo: txt(r.responsavel_tipo),
  }));
  const contas = (await c.consultar<Record<string, unknown>>(CONSULTAS.contas)).map((r) => ({
    codi_emp: num(r.codi_emp), i_conta_caixa: num(r.i_conta_caixa), i_banco: r.i_banco == null ? null : num(r.i_banco),
    agencia: txt(r.agencia), identificador: txt(r.identificador_conta), codigo_banco: txt(r.codigo_banco), nome_banco: txt(r.descricao_banco),
  }));
  const encerradas = opcoes.sqlEncerradas
    ? (await c.consultar<Record<string, unknown>>(opcoes.sqlEncerradas)).map((r) => ({ codi_emp: num(r.codi_emp), i_conta_caixa: num(r.i_conta_caixa) }))
    : [];
  let diagnostico: Record<string, unknown> | undefined;
  if (opcoes.diagnostico) {
    diagnostico = {};
    for (const [nome, sql] of [['moduloWeb', CONSULTAS.diagModuloWeb], ['publicados', CONSULTAS.diagPublicados], ['processos', CONSULTAS.diagProcessos]] as const) {
      try { diagnostico[nome] = (await c.consultar(sql))[0]; } catch (e) { diagnostico[nome] = { erro: (e as Error).message }; }
    }
  }
  return { empresas, contatos, responsaveis, contas, encerradas, ...(diagnostico ? { diagnostico } : {}) };
}
