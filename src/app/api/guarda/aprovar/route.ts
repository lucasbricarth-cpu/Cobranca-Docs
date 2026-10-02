export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { aprovarExclusao } from '@/lib/guarda';

const Corpo = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000), motivo: z.enum(['guarda', 'pasta_geral']) });

/** Aprovação de um Admin: exclui os documentos vencidos selecionados (confere de novo cada um). */
export async function POST(req: Request) {
  return tratar(async () => {
    const admin = await exigirAdmin();
    const d = Corpo.parse(await req.json());
    const r = await aprovarExclusao({ ids: d.ids, motivo: d.motivo, usuarioId: admin.id });
    return ok(r);
  });
}
