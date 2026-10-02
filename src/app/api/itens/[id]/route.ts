export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { cancelarItem } from '@/lib/pedidos';
import { q } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirFuncionario();
    const d = z.object({ cancelar: z.boolean().optional(), prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(await req.json());
    if (d.cancelar) await cancelarItem(params.id);
    if (d.prazo) await q(`UPDATE itens_pedido SET prazo = $2 WHERE id = $1`, [params.id, d.prazo]);
    return ok();
  });
}
