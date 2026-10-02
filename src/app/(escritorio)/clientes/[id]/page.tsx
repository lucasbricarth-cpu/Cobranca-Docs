import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { dadosDaEmpresa } from '@/lib/consultas/empresas';
import { formatarCnpj } from '@/lib/texto';

export const dynamic = 'force-dynamic';

/** Provisório da Etapa 2 (a Etapa 3 troca pela tela da empresa por mês). */
export default async function Empresa({ params }: { params: { id: string } }) {
  await exigirFuncionario();
  const e = await dadosDaEmpresa(params.id);
  if (!e) notFound();
  return (
    <div>
      <h1 className="titulo-pagina">{e.nome}</h1>
      <p className="text-[13px] text-fg-3 mb-4"><span className="mono">{formatarCnpj(e.cnpj)}</span> · {e.responsavel ?? 'sem responsável'}</p>
      <Link className="btn" href={`/clientes/${e.id}/acessos`}>Acessos</Link>
    </div>
  );
}
