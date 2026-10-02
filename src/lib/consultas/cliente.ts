import { um } from '@/lib/db';

export async function pendentesDoLogin(loginId: string): Promise<number> {
  try {
    const r = await um<{ n: string }>(
      `SELECT count(*) AS n FROM itens_pedido i
       JOIN vinculos_login_empresa v ON v.empresa_id = i.empresa_id
       WHERE v.login_id = $1 AND i.status IN ('pendente', 'refazer')`, [loginId]);
    return Number(r?.n ?? 0);
  } catch { return 0; }
}
