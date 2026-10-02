export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { encerrarSessao } from '@/lib/auth/sessao';

export async function POST() {
  return tratar(async () => { await encerrarSessao(); return ok(); });
}
