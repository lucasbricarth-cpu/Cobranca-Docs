import { um, todos as todosQ } from '@/lib/db';
import type { Funcionario } from '@/lib/auth/sessao';
import { hojeSP, somarDias } from '@/lib/tempo';
import { nomeDoSubtipo } from '@/lib/documentos/nomes';

/** Contadores das barras (a fila A conferir e os Não reconhecidos do funcionário). */
export async function contadoresDoFuncionario(s: Funcionario): Promise<{ conferir: number; naoReconhecidos: number }> {
  try {
    const r = await um<{ conferir: string; nao: string }>(
      `SELECT
         (SELECT count(*) FROM documentos d LEFT JOIN empresas e ON e.id = d.empresa_id
           WHERE d.status = 'a_conferir' AND d.excluido_em IS NULL AND ($1 OR e.responsavel_id = $2)) AS conferir,
         (SELECT count(*) FROM documentos d LEFT JOIN empresas e ON e.id = d.empresa_id
           WHERE d.status = 'nao_reconhecido' AND d.excluido_em IS NULL AND ($1 OR e.responsavel_id = $2 OR d.empresa_id IS NULL)) AS nao`,
      [s.papel === 'admin', s.id]);
    return { conferir: Number(r?.conferir ?? 0), naoReconhecidos: Number(r?.nao ?? 0) };
  } catch {
    // Antes da migration 002 a tabela documentos não existe.
    return { conferir: 0, naoReconhecidos: 0 };
  }
}


export interface Pendencia { item_id: string; empresa_id: string; empresa: string; titulo: string; prazo: string; status: string }

/** Itens abertos com prazo numa faixa (atrasados: antes de hoje; semana: de hoje a +6 dias). */
export async function pendencias(faixa: 'atrasados' | 'semana', responsavelId: string | null, limite = 6): Promise<{ total: number; itens: Pendencia[] }> {
  const hoje = hojeSP();
  const [de, ate] = faixa === 'atrasados' ? ['1900-01-01', somarDias(hoje, -1)] : [hoje, somarDias(hoje, 6)];
  const linhas = await todosQ<Record<string, unknown>>(
    `SELECT i.id AS item_id, e.id AS empresa_id, e.nome AS empresa, t.nome AS tipo_nome, to_char(i.prazo, 'YYYY-MM-DD') AS prazo, i.status,
            s.nome AS sub_nome, s.cartao_final, s.cartao_emissor, cb.codigo_banco, cb.nome_banco, cb.final AS conta_final,
            count(*) OVER () AS total
     FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id JOIN tipos_documento t ON t.id = i.tipo_id
     LEFT JOIN subtipos s ON s.id = i.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     WHERE i.status IN ('pendente', 'refazer') AND i.prazo BETWEEN $1 AND $2 AND ($3::uuid IS NULL OR e.responsavel_id = $3)
     ORDER BY i.prazo, e.nome LIMIT $4`, [de, ate, responsavelId, limite]);
  return {
    total: Number(linhas[0]?.total ?? 0),
    itens: linhas.map((r) => {
      const sub = nomeDoSubtipo({ nome: r.sub_nome as string, cartao_final: r.cartao_final as string, cartao_emissor: r.cartao_emissor as string, codigo_banco: r.codigo_banco as string, nome_banco: r.nome_banco as string, conta_final: r.conta_final as string });
      return { item_id: r.item_id as string, empresa_id: r.empresa_id as string, empresa: r.empresa as string, titulo: sub ? `${r.tipo_nome} · ${sub}` : (r.tipo_nome as string), prazo: r.prazo as string, status: r.status as string };
    }),
  };
}

/** Entrega do mês na carteira: total, recebidos e conferidos, no geral e por responsável. */
export async function entregaDoMes(competencia: string, responsavelId: string | null) {
  const porResp = await todosQ<{ responsavel_id: string | null; responsavel: string | null; total: number; recebidos: number; conferidos: number; empresas: number }>(
    `SELECT e.responsavel_id, u.nome AS responsavel, count(i.id)::int AS total,
            count(i.id) FILTER (WHERE i.status IN ('recebido', 'conferido'))::int AS recebidos,
            count(i.id) FILTER (WHERE i.status = 'conferido')::int AS conferidos,
            count(DISTINCT e.id)::int AS empresas
     FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id LEFT JOIN usuarios u ON u.id = e.responsavel_id
     WHERE i.competencia = $1 AND i.status <> 'cancelado' AND ($2::uuid IS NULL OR e.responsavel_id = $2)
     GROUP BY e.responsavel_id, u.nome ORDER BY u.nome NULLS LAST`, [competencia, responsavelId]);
  const soma = porResp.reduce((a, r) => ({ total: a.total + r.total, recebidos: a.recebidos + r.recebidos, conferidos: a.conferidos + r.conferidos }), { total: 0, recebidos: 0, conferidos: 0 });
  return { ...soma, porResponsavel: porResp };
}
