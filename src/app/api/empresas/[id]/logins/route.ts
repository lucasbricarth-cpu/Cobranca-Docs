export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { convidarCliente, loginsDaEmpresa } from '@/lib/logins';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => { await exigirFuncionario(); return ok({ logins: await loginsDaEmpresa(params.id) }); });
}
/** Convida um contato: o login nasce ligado a esta empresa (e às outras escolhidas). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    const d = z.object({ nome: z.string().min(2).max(120), email: z.string().email(), outrasEmpresas: z.array(z.string().uuid()).default([]) }).parse(await req.json());
    const r = await convidarCliente({ nome: d.nome, email: d.email, empresaIds: [params.id, ...d.outrasEmpresas] }, s.id);
    return ok(r);
  });
}
