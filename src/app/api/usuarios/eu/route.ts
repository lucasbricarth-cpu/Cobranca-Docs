export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { q } from '@/lib/db';

/** Preferências do próprio funcionário (resumo diário por e-mail). */
export async function PATCH(req: Request) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    const d = z.object({ resumoDiario: z.boolean() }).parse(await req.json());
    await q(`UPDATE usuarios SET resumo_diario = $2 WHERE id = $1`, [s.id, d.resumoDiario]);
    return ok();
  });
}
