import type { PoolClient } from 'pg';
import { q, todos, um } from '@/lib/db';
import { ErroApi } from '@/lib/api';
import { nomeDoSubtipo, type DadosDoSubtipo } from './nomes';

/**
 * Subtipos por empresa:
 * - Extrato: um por conta, criado a partir do leitor da Domínio;
 * - Fatura de cartão: cadastrada no app, só os 4 últimos dígitos;
 * - Outros: livres, criados pelo escritório.
 * A pasta usa o ID do subtipo, não o nome.
 */
export interface Subtipo extends DadosDoSubtipo {
  id: string; empresa_id: string; tipo_id: string; ativo: boolean;
  conta_situacao: string | null; sugestao_encerrada_em: Date | null;
}

const SELECT_SUBTIPO = `
  SELECT s.id, s.empresa_id, s.tipo_id, s.nome, s.ativo, s.cartao_final, s.cartao_emissor,
         c.codigo_banco, c.nome_banco, c.final AS conta_final, c.situacao AS conta_situacao, c.sugestao_encerrada_em
  FROM subtipos s LEFT JOIN contas_bancarias c ON c.id = s.conta_bancaria_id`;

export async function subtiposDaEmpresa(empresaId: string, tipoId?: string): Promise<(Subtipo & { rotulo: string })[]> {
  const linhas = await todos<Subtipo>(`${SELECT_SUBTIPO} WHERE s.empresa_id = $1 AND ($2::uuid IS NULL OR s.tipo_id = $2) ORDER BY s.tipo_id, c.codigo_banco NULLS LAST, s.criado_em`, [empresaId, tipoId ?? null]);
  return linhas.map((l) => ({ ...l, rotulo: nomeDoSubtipo(l) }));
}
export async function subtipoPorId(id: string): Promise<(Subtipo & { rotulo: string }) | null> {
  const l = await um<Subtipo>(`${SELECT_SUBTIPO} WHERE s.id = $1`, [id]);
  return l ? { ...l, rotulo: nomeDoSubtipo(l) } : null;
}

/** Chamado ao fim de cada sincronização do leitor: um subtipo de Extrato por conta. */
export async function aoSincronizarContas(c: PoolClient): Promise<void> {
  await c.query(`
    INSERT INTO subtipos (empresa_id, tipo_id, conta_bancaria_id)
    SELECT cb.empresa_id, t.id, cb.id
    FROM contas_bancarias cb CROSS JOIN tipos_documento t
    WHERE t.subtipo_origem = 'contas' AND t.ativo
    ON CONFLICT (tipo_id, conta_bancaria_id) DO NOTHING`);
}

export async function criarCartao(empresaId: string, tipoId: string, final: string, emissor?: string) {
  const f = final.replace(/\D/g, '');
  if (!/^\d{4}$/.test(f)) throw new ErroApi('Informe só os 4 últimos dígitos do cartão.');
  await exigirOrigem(tipoId, 'cartoes');
  const r = await um<{ id: string }>(
    `INSERT INTO subtipos (empresa_id, tipo_id, cartao_final, cartao_emissor) VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, tipo_id, cartao_final) WHERE cartao_final IS NOT NULL DO NOTHING RETURNING id`,
    [empresaId, tipoId, f, emissor?.trim() || null]);
  if (!r) throw new ErroApi('Este cartão já está cadastrado.');
  return r.id;
}
export async function criarLivre(empresaId: string, tipoId: string, nome: string) {
  await exigirOrigem(tipoId, 'livre');
  const r = await um<{ id: string }>(`INSERT INTO subtipos (empresa_id, tipo_id, nome) VALUES ($1, $2, $3) RETURNING id`, [empresaId, tipoId, nome.trim()]);
  return r!.id;
}
export async function renomearSubtipo(id: string, nome: string | null) {
  await q(`UPDATE subtipos SET nome = $2 WHERE id = $1`, [id, nome?.trim() || null]);
}
/** "Parar de pedir" / voltar a pedir. Para conta encerrada, quem confirma é o funcionário. */
export async function ativarSubtipo(id: string, ativo: boolean) {
  await q(`UPDATE subtipos SET ativo = $2 WHERE id = $1`, [id, ativo]);
  if (!ativo) {
    await q(`UPDATE contas_bancarias SET pedir = false WHERE id = (SELECT conta_bancaria_id FROM subtipos WHERE id = $1)`, [id]);
  } else {
    await q(`UPDATE contas_bancarias SET pedir = true WHERE id = (SELECT conta_bancaria_id FROM subtipos WHERE id = $1)`, [id]);
  }
}
async function exigirOrigem(tipoId: string, origem: string) {
  const t = await um<{ subtipo_origem: string | null }>(`SELECT subtipo_origem FROM tipos_documento WHERE id = $1`, [tipoId]);
  if (t?.subtipo_origem !== origem) throw new ErroApi('Este tipo não aceita esse subtipo.');
}
