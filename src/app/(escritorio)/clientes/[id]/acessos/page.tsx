import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { dadosDaEmpresa } from '@/lib/consultas/empresas';
import { loginsDaEmpresa } from '@/lib/logins';
import { todos } from '@/lib/db';
import { formatarCnpj } from '@/lib/texto';
import { Acessos } from './Acessos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acessos' };

/** Logins de cliente ligados à empresa: convidar, desativar, vínculos. Os contatos da Domínio aparecem como sugestão. */
export default async function PaginaAcessos({ params }: { params: { id: string } }) {
  await exigirFuncionario();
  const empresa = await dadosDaEmpresa(params.id);
  if (!empresa) notFound();
  const [logins, contatos, outras] = await Promise.all([
    loginsDaEmpresa(params.id),
    todos<{ nome: string | null; email: string | null; telefone: string | null }>(`SELECT nome, email, telefone FROM contatos_empresa WHERE empresa_id = $1 AND email IS NOT NULL ORDER BY nome`, [params.id]),
    todos<{ id: string; nome: string }>(`SELECT id, nome FROM empresas WHERE id <> $1 AND ativo ORDER BY nome`, [params.id]),
  ]);
  return (
    <div className="max-w-[760px]">
      <Link href={`/clientes/${params.id}`} className="btn btn-ghost btn-sm mb-3 -ml-2"><ChevronLeft size={14} />{empresa.nome}</Link>
      <h1 className="titulo-pagina mb-1">Acessos</h1>
      <p className="text-[13px] text-fg-3 mb-5"><span className="mono">{formatarCnpj(empresa.cnpj)}</span> · o cliente nunca se cadastra sozinho: o login nasce pelo convite do escritório.</p>
      <Acessos
        empresaId={params.id}
        logins={logins.map((l) => ({ id: l.id, nome: l.nome, email: l.email, ativo: l.ativo, passkeys: Number(l.passkeys), outras: Number(l.outras) }))}
        sugestoes={contatos.filter((c) => !logins.some((l) => l.email === c.email)).map((c) => ({ nome: c.nome ?? '', email: c.email! }))}
        outrasEmpresas={outras}
      />
    </div>
  );
}
