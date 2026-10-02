import { todos, um } from '@/lib/db';
import { checklistDoMes, type ItemDoMes } from '@/lib/documentos/consultas';
import { competenciaPadrao } from '@/lib/tempo';

export async function pendentesDoLogin(loginId: string): Promise<number> {
  try {
    const r = await um<{ n: string }>(
      `SELECT count(*) AS n FROM itens_pedido i
       JOIN vinculos_login_empresa v ON v.empresa_id = i.empresa_id
       WHERE v.login_id = $1 AND i.status IN ('pendente', 'refazer')`, [loginId]);
    return Number(r?.n ?? 0);
  } catch { return 0; }
}

/** Checklist do cliente: o mês que está sendo coletado e, à parte, o que ficou aberto de outros meses. */
export async function checklistDoCliente(empresaId: string): Promise<{ competencia: string; doMes: ItemDoMes[]; outros: (ItemDoMes & { competencia: string })[] }> {
  const competencia = competenciaPadrao();
  const doMes = await checklistDoMes(empresaId, competencia);
  const meses = await todos<{ competencia: string }>(
    `SELECT DISTINCT to_char(competencia, 'YYYY-MM-DD') AS competencia FROM itens_pedido
     WHERE empresa_id = $1 AND competencia <> $2 AND status IN ('pendente', 'refazer') ORDER BY 1 DESC`, [empresaId, competencia]);
  const outros: (ItemDoMes & { competencia: string })[] = [];
  for (const m of meses) {
    for (const i of await checklistDoMes(empresaId, m.competencia)) if (i.status !== 'recebido' && i.status !== 'conferido') outros.push({ ...i, competencia: m.competencia });
  }
  return { competencia, doMes, outros };
}

/** Item visto pelo cliente: só se a empresa estiver nos vínculos do login (senão, como se não existisse). */
export async function itemParaCliente(empresasDoLogin: { id: string }[], itemId: string) {
  const i = await um<Record<string, unknown>>(
    `SELECT i.id, i.empresa_id, i.tipo_id, i.subtipo_id, i.status, to_char(i.prazo, 'YYYY-MM-DD') AS prazo, to_char(i.competencia, 'YYYY-MM-DD') AS competencia,
            i.motivo_refazer, i.mensagem, t.nome AS tipo_nome, t.sensivel, e.nome AS empresa,
            s.nome AS sub_nome, s.cartao_final, s.cartao_emissor, cb.codigo_banco, cb.nome_banco, cb.final AS conta_final
     FROM itens_pedido i JOIN tipos_documento t ON t.id = i.tipo_id JOIN empresas e ON e.id = i.empresa_id
     LEFT JOIN subtipos s ON s.id = i.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     WHERE i.id = $1`, [itemId]);
  if (!i || !empresasDoLogin.some((e) => e.id === i.empresa_id)) return null;
  return i;
}
