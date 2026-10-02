import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { uuidOuNada } from '@/lib/url';
import { exigirAdmin } from '@/lib/auth/sessao';
import { dadosDaEmpresa } from '@/lib/consultas/empresas';
import { situacaoDaSaida } from '@/lib/guarda';
import { formatarCnpj } from '@/lib/texto';
import { Saida } from './Saida';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saída do cliente' };

/** Saída de um cliente (Admin): "Exportar tudo" em ZIP e, depois, a exclusão aprovada. */
export default async function PaginaSaida({ params }: { params: { id: string } }) {
  await exigirAdmin();
  if (!uuidOuNada(params.id)) notFound();
  const empresa = await dadosDaEmpresa(params.id);
  if (!empresa) notFound();
  const s = await situacaoDaSaida(params.id);
  return (
    <div className="max-w-[760px]">
      <Link href={`/clientes/${params.id}`} className="btn btn-ghost btn-sm mb-3 -ml-2"><ChevronLeft size={14} />{empresa.nome}</Link>
      <h1 className="titulo-pagina mb-1">Saída do cliente</h1>
      <p className="text-[13px] text-fg-3 mb-5"><span className="mono">{formatarCnpj(empresa.cnpj)}</span> · primeiro exporte tudo; depois, se for o caso, um Admin aprova a exclusão dos documentos.</p>
      <Saida
        empresaId={params.id}
        cnpj={formatarCnpj(empresa.cnpj)}
        situacao={{
          documentos: s.documentos, exportacaoAtual: s.exportacaoAtual, arquivos: s.arquivos,
          exportadaEm: s.exportada_em?.toISOString() ?? null, exportadaPor: s.exportada_por,
          ultimoRecebido: s.ultimo_recebido?.toISOString() ?? null, saidaEm: s.saida_em?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
