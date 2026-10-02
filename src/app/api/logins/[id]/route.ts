export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { desativarLogin, reativarLogin, vincularEmpresa, desvincularEmpresa } from '@/lib/logins';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirFuncionario();
    const d = z.object({ ativo: z.boolean().optional(), vincular: z.string().uuid().optional(), desvincular: z.string().uuid().optional() }).parse(await req.json());
    if (d.ativo === false) await desativarLogin(params.id);
    if (d.ativo === true) await reativarLogin(params.id);
    if (d.vincular) await vincularEmpresa(params.id, d.vincular);
    if (d.desvincular) await desvincularEmpresa(params.id, d.desvincular);
    return ok();
  });
}
