export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { criarFuncionario } from '@/lib/logins';

export async function POST(req: Request) {
  return tratar(async () => {
    await exigirAdmin();
    const d = z.object({ nome: z.string().min(2), email: z.string().email(), papel: z.enum(['admin', 'funcionario']), iResponsavel: z.number().int().nullable().optional() }).parse(await req.json());
    return ok({ id: await criarFuncionario(d) });
  });
}
