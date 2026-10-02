export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { alterarFuncionario } from '@/lib/logins';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await exigirAdmin();
    const d = z.object({ papel: z.enum(['admin', 'funcionario']).optional(), ativo: z.boolean().optional(), iResponsavel: z.number().int().nullable().optional() }).parse(await req.json());
    await alterarFuncionario(params.id, d, s.id);
    return ok();
  });
}
