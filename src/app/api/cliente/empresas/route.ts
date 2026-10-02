export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { exigirCliente } from '@/lib/auth/sessao';

/** As empresas do login (sempre dos vínculos, vindas do servidor). */
export async function GET() {
  return tratar(async () => { const s = await exigirCliente(); return ok({ empresas: s.empresas }); });
}
