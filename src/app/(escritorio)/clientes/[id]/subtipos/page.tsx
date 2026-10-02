import Link from 'next/link';
import { notFound } from 'next/navigation';
import { uuidOuNada } from '@/lib/url';
import { ChevronLeft } from 'lucide-react';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { dadosDaEmpresa } from '@/lib/consultas/empresas';
import { subtiposDaEmpresa } from '@/lib/documentos/subtipos';
import { listarTipos } from '@/lib/documentos/tipos';
import { Subtipos } from './Subtipos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subtipos' };

export default async function PaginaSubtipos({ params }: { params: { id: string } }) {
  await exigirFuncionario();
  if (!uuidOuNada(params.id)) notFound();
  const empresa = await dadosDaEmpresa(params.id);
  if (!empresa) notFound();
  const [tipos, subtipos] = await Promise.all([listarTipos(true), subtiposDaEmpresa(params.id)]);
  const comSub = tipos.filter((t) => t.subtipo_origem);
  return (
    <div className="max-w-[760px]">
      <Link href={`/clientes/${params.id}`} className="btn btn-ghost btn-sm mb-3 -ml-2"><ChevronLeft size={14} />{empresa.nome}</Link>
      <h1 className="titulo-pagina mb-1">Subtipos</h1>
      <p className="text-[13px] text-fg-3 mb-5">As contas vêm do leitor da Domínio. Cartões guardam só os 4 últimos dígitos. Renomear não quebra o histórico.</p>
      <Subtipos empresaId={params.id}
        grupos={comSub.map((t) => ({ tipo: { id: t.id, nome: t.nome, origem: t.subtipo_origem! },
          itens: subtipos.filter((x) => x.tipo_id === t.id).map((x) => ({ id: x.id, rotulo: x.rotulo, apelido: x.conta_final ? x.nome ?? null : null, ativo: x.ativo, encerrada: x.conta_situacao === 'encerrada' })) }))} />
    </div>
  );
}
