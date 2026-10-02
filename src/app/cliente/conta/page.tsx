import Link from 'next/link';
import { exigirCliente } from '@/lib/auth/sessao';
import { todos } from '@/lib/db';
import { cnpjParcial } from '@/lib/texto';
import { Conta } from './Conta';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha conta' };

export default async function MinhaConta({ searchParams }: { searchParams: { 'bem-vindo'?: string } }) {
  const s = await exigirCliente();
  const passkeys = await todos<{ id: string; apelido: string | null; criado_em: Date }>(`SELECT id, apelido, criado_em FROM passkeys WHERE login_id = $1 ORDER BY criado_em`, [s.id]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina mb-1">{searchParams['bem-vindo'] ? `Bem-vindo, ${s.nome.split(' ')[0]}!` : 'Minha conta'}</h1>
        <p className="text-[13.5px] text-fg-3">{s.email}</p>
      </div>
      <section className="card p-4">
        <div className="eyebrow mb-2">Suas empresas</div>
        <div className="lista">
          {s.empresas.map((e) => (
            <div key={e.id} className="linha"><span className="flex-1 min-w-0"><div className="linha-titulo truncate">{e.nome}</div><div className="linha-sub mono">{cnpjParcial(e.cnpj)}</div></span></div>
          ))}
        </div>
      </section>
      <Conta temPasskey={passkeys.length > 0} />
      <Link href="/privacidade" className="text-[13px] text-fg-3 underline self-start">Aviso de privacidade</Link>
    </div>
  );
}
