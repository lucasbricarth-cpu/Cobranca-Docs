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
