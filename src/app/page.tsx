import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/auth/sessao';

export const dynamic = 'force-dynamic';

export default async function Raiz() {
  const s = await sessaoAtual();
  if (!s) redirect('/entrar');
  redirect(s.tipo === 'cliente' ? '/cliente' : '/inicio');
}
