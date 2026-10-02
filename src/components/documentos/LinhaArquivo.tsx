'use client';

import Link from 'next/link';
import { FileText, Lock, FileCode2 } from 'lucide-react';
import type { ArquivoDaLista } from '@/lib/documentos/consultas';
import { Pilula, type StatusItem } from '@/components/ui/Pilula';
import { IconeOrigem } from '@/components/empresa/ChecklistMes';
import { dataCurta } from '@/lib/tempo';

const STATUS_DOC: Record<string, StatusItem> = { a_conferir: 'recebido', conferido: 'conferido', rejeitado: 'refazer', substituido: 'substituido', nao_reconhecido: 'pendente' };

/** Cada arquivo: miniatura (ou 🔒 nos sensíveis), nome gerado, quando, quem e por onde veio, e o status. */
export function LinhaArquivo({ a, href, ativo, arrastavel, mostrarEmpresa }: { a: ArquivoDaLista; href: string; ativo?: boolean; arrastavel?: boolean; mostrarEmpresa?: boolean }) {
  return (
    <Link
      href={href} scroll={false} className={`linha ${ativo ? 'is-on' : ''}`} data-doc={a.id}
      draggable={arrastavel}
      onDragStart={arrastavel ? (e) => { e.dataTransfer.setData('application/x-documento', JSON.stringify({ id: a.id, empresaId: a.empresa_id, nome: a.nome })); e.dataTransfer.effectAllowed = 'move'; } : undefined}
    >
      <span className="mini">
        {a.sensivel ? <Lock size={18} aria-label="Sensível" /> : a.tem_miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/documentos/${a.id}/miniatura`} alt="" loading="lazy" />
        ) : a.extensao === 'xml' || a.extensao === 'ofx' ? <FileCode2 size={18} aria-hidden /> : <FileText size={18} aria-hidden />}
      </span>
      <span className="flex-1 min-w-0">
        <div className={`linha-titulo truncate ${a.status === 'substituido' ? 'line-through text-fg-3' : ''}`}>{a.status === 'nao_reconhecido' ? a.nome_original : a.nome}</div>
        <div className="linha-sub truncate">
          {mostrarEmpresa ? `${a.empresa_nome ?? (a.whatsapp_numero ? `+${a.whatsapp_numero}` : 'Sem empresa')} · ` : ''}
          {dataCurta(a.recebido_em)}{a.enviado_por ? ` · ${a.enviado_por}` : ''}
        </div>
      </span>
      <IconeOrigem origem={a.origem} />
      {a.status === 'nao_reconhecido' ? <span className="pill">Não reconhecido</span> : <Pilula status={STATUS_DOC[a.status] ?? 'pendente'} />}
    </Link>
  );
}
