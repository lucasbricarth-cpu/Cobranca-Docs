export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar, ErroApi } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { marcarPiloto } from '@/lib/piloto';
import { uuidOuNada } from '@/lib/url';

/** Entra ou sai do piloto (Admin). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirAdmin();
    const empresaId = uuidOuNada(params.id);
    if (!empresaId) throw new ErroApi('Empresa não encontrada.', 404);
    const d = z.object({ piloto: z.boolean() }).parse(await req.json());
    await marcarPiloto(empresaId, d.piloto);
    return ok();
  });
}
