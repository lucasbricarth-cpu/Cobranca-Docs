import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/auth/sessao';
import { FormEntrar } from './FormEntrar';
import { Marca } from '@/components/ui/Marca';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: { erro?: string; destino?: string } }) {
  const s = await sessaoAtual();
  if (s) redirect(s.tipo === 'cliente' ? '/cliente' : '/inicio');
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-[420px] p-7 md:p-8 gd-rise" style={{ borderRadius: 26 }}>
        <div className="flex items-center gap-3 mb-6"><Marca /></div>
        <h1 className="titulo-pagina mb-1">Entrar</h1>
        <p className="text-[13.5px] text-fg-3 mb-6">Digite o seu e-mail. Você recebe um link para entrar, ou usa a sua digital ou rosto se já cadastrou.</p>
        <FormEntrar erro={searchParams.erro} destino={searchParams.destino} />
      </div>
    </main>
  );
}
