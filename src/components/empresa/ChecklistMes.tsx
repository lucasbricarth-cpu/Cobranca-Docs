import Link from 'next/link';
import { MessageCircle, Smartphone, Building2, Lock } from 'lucide-react';
import type { ItemDoMes } from '@/lib/documentos/consultas';
import { Pilula } from '@/components/ui/Pilula';
import { dataCurta } from '@/lib/tempo';
import { comParametros } from '@/lib/url';

/** Uma linha por item de pedido do mês: "Extrato Itaú final 0567 · Conferido · chegou em 03/10 pelo WhatsApp". */
export function frase(i: ItemDoMes, pontoDeVista: 'escritorio' | 'cliente' = 'escritorio'): string {
  const por = i.origem === 'whatsapp' ? ' pelo WhatsApp' : i.origem === 'app' ? ' pelo app' : '';
  if (i.status === 'conferido') return `${pontoDeVista === 'cliente' ? 'Conferido pelo escritório' : 'Conferido'}${i.recebido_em ? ` · chegou em ${dataCurta(i.recebido_em)}${por}` : ''}`;
  if (i.status === 'recebido') return `${pontoDeVista === 'cliente' ? 'Enviado' : 'Recebido · a conferir'}${i.recebido_em ? ` · chegou em ${dataCurta(i.recebido_em)}${por}` : ''}`;
  if (i.status === 'refazer') return i.motivo_refazer ? `Refazer · ${i.motivo_refazer}` : 'Refazer';
  const prazo = i.prazo ? ` · prazo ${dataCurta(i.prazo)}` : '';
  const lembrete = i.ultimo_lembrete ? ` · lembrete enviado em ${dataCurta(i.ultimo_lembrete)}` : '';
  return `${i.status === 'atrasado' ? 'Atrasado' : 'Falta'}${pontoDeVista === 'escritorio' ? lembrete || prazo : prazo}`;
}

export function IconeOrigem({ origem }: { origem: string | null }) {
  if (origem === 'whatsapp') return <MessageCircle size={14} aria-label="Veio pelo WhatsApp" className="text-fg-3" />;
  if (origem === 'app') return <Smartphone size={14} aria-label="Veio pelo app" className="text-fg-3" />;
  if (origem === 'escritorio') return <Building2 size={14} aria-label="Enviado pelo escritório" className="text-fg-3" />;
  return null;
}

export function ChecklistMes({ itens, params, docAtivo }: { itens: ItemDoMes[]; params: Record<string, string | undefined>; docAtivo?: string }) {
  if (!itens.length) return <div className="vazio">Nenhum pedido neste mês. Crie em Pedidos ou pela Agenda.</div>;
  return (
    <div className="lista">
      {itens.map((i) => {
        const conteudo = (
          <>
            <span className="flex-1 min-w-0">
              <div className="linha-titulo flex items-center gap-1.5">{i.sensivel && <Lock size={13} aria-label="Sensível" />}<span className="truncate">{i.titulo}</span></div>
              <div className="linha-sub">{frase(i)}</div>
            </span>
            <IconeOrigem origem={i.origem} />
            <Pilula status={i.status} />
          </>
        );
        return i.documento_id ? (
          <Link key={i.id} href={comParametros(params, { doc: i.documento_id })} scroll={false} className={`linha ${docAtivo === i.documento_id ? 'is-on' : ''}`} data-item={i.id}>{conteudo}</Link>
        ) : (
          <div key={i.id} className="linha" data-item={i.id}>{conteudo}</div>
        );
      })}
    </div>
  );
}
