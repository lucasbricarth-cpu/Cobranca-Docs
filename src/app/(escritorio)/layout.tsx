import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { CascaEscritorio } from '@/components/cascas/CascaEscritorio';
import { sessaoAtual } from '@/lib/auth/sessao';
import { contadoresDoFuncionario } from '@/lib/consultas/inicio';

export const dynamic = 'force-dynamic';

/** Todas as telas do funcionário passam por aqui: sem sessão de funcionário, vai para /entrar. */
export default async function LayoutEscritorio({ children }: { children: ReactNode }) {
  const s = await sessaoAtual();
  if (!s) redirect('/entrar');
  if (s.tipo === 'cliente') redirect('/cliente');
  const contadores = await contadoresDoFuncionario(s);
  return (
    <CascaEscritorio nome={s.nome} papel={s.papel} contadores={contadores}>
      {children}
    </CascaEscritorio>
  );
}
