import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Lock } from 'lucide-react';
import { exigirCliente } from '@/lib/auth/sessao';
import { itemParaCliente } from '@/lib/consultas/cliente';
import { uuidOuNada } from '@/lib/url';
import { nomeDoSubtipo } from '@/lib/documentos/nomes';
import { statusDaTela } from '@/lib/documentos/consultas';
import { nomeDoMes, dataCurta } from '@/lib/tempo';
import { Pilula } from '@/components/ui/Pilula';
import { BotoesEnvio } from '@/components/envio/BotoesEnvio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedido' };

const TEXTO: Record<string, string> = { pendente: 'Pendente', atrasado: 'Atrasado', recebido: 'Enviado', conferido: 'Conferido pelo escritório', refazer: 'Refazer' };

/** Destino do link do e-mail: abre direto o item. O servidor confere o vínculo do login com a empresa. */
export default async function ItemCliente({ params }: { params: { id: string } }) {
  const s = await exigirCliente();
  if (!uuidOuNada(params.id)) notFound();
  // Item de outra empresa (fora dos vínculos) é como se não existisse.
  const i = await itemParaCliente(s.empresas, params.id);
  if (!i) notFound();
  const sub = nomeDoSubtipo({ nome: i.sub_nome as string, cartao_final: i.cartao_final as string, cartao_emissor: i.cartao_emissor as string, codigo_banco: i.codigo_banco as string, nome_banco: i.nome_banco as string, conta_final: i.conta_final as string });
  const titulo = `${i.tipo_nome}${sub ? ` ${sub}` : ''}`;
  const st = statusDaTela(i.status as string, i.prazo as string | null);
  const aberto = ['pendente', 'atrasado', 'refazer'].includes(st);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/cliente" className="btn btn-ghost btn-sm self-start -ml-2"><ChevronLeft size={14} />Pendentes</Link>
      <div>
        <div className="eyebrow">{i.empresa as string}</div>
        <h1 className="titulo-pagina mt-1 flex items-center gap-2">{Boolean(i.sensivel) && <Lock size={18} />}{titulo}</h1>
        <p className="text-[14px] text-fg-3 mt-1">{nomeDoMes(i.competencia as string)}{i.prazo ? ` · prazo ${dataCurta(i.prazo as string, true)}` : ''}</p>
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <Pilula status={st} texto={TEXTO[st]} />
        {st === 'refazer' && <p className="text-[14px] text-[var(--warn-text)]">{(i.motivo_refazer as string) ?? 'O escritório pediu para enviar de novo.'}</p>}
        {Boolean(i.mensagem) && <p className="text-[14px]">{i.mensagem as string}</p>}
        {aberto && (
          <>
            <BotoesEnvio item={{ id: i.id as string, titulo, empresaId: i.empresa_id as string, tipoId: i.tipo_id as string, subtipoId: i.subtipo_id as string | null, sensivel: Boolean(i.sensivel) }}
              empresas={s.empresas.map((e) => ({ id: e.id, nome: e.nome, cnpj: e.cnpj }))} escanear />
            <BotoesEnvio item={{ id: i.id as string, titulo, empresaId: i.empresa_id as string, tipoId: i.tipo_id as string, subtipoId: i.subtipo_id as string | null, sensivel: Boolean(i.sensivel) }}
              empresas={s.empresas.map((e) => ({ id: e.id, nome: e.nome, cnpj: e.cnpj }))} grande />
          </>
        )}
      </div>
    </div>
  );
}
