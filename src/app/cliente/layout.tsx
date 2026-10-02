import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { CascaCliente } from '@/components/cascas/CascaCliente';
import { sessaoAtual } from '@/lib/auth/sessao';
import { pendentesDoLogin } from '@/lib/consultas/cliente';

export const dynamic = 'force-dynamic';

export default async function LayoutCliente({ children }: { children: ReactNode }) {
  const s = await sessaoAtual();
  if (!s) redirect('/entrar');
  if (s.tipo === 'funcionario') redirect('/inicio');
  const pendentes = await pendentesDoLogin(s.id);
  return <CascaCliente pendentes={pendentes}>{children}</CascaCliente>;
}
