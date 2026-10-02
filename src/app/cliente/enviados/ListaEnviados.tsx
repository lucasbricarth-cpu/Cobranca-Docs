'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MessageCircle, Smartphone } from 'lucide-react';
import { Pilula, type StatusItem } from '@/components/ui/Pilula';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/components/envio/http';
import { dataCurta } from '@/lib/tempo';

interface Item { id: string; empresaId: string; empresa: string; status: string; origem: string; recebido_em: string; motivo: string | null; mes: string; nome: string }
const ST: Record<string, [StatusItem, string]> = {
  processando: ['recebido', 'Enviado'], a_conferir: ['recebido', 'Enviado'], nao_reconhecido: ['recebido', 'Enviado'],
  conferido: ['conferido', 'Conferido pelo escritório'], rejeitado: ['refazer', 'Refazer'], substituido: ['substituido', 'Substituído'],
};

export function ListaEnviados({ itens, empresas }: { itens: Item[]; empresas: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [mudar, setMudar] = useState<Item | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const grupos = new Map<string, Item[]>();
  for (const i of itens) grupos.set(i.mes, [...(grupos.get(i.mes) ?? []), i]);
  async function abrir(id: string) {
    const r = await api<{ url: string }>(`/api/documentos/${id}/url?modo=abrir`);
    if (r.ok) window.open(r.url, '_blank', 'noopener');
  }
  async function mover(empresaId: string) {
    if (!mudar) return;
    const r = await api(`/api/envios/documento/${mudar.id}/empresa`, 'POST', { empresaId });
    if (!r.ok) return setErro(r.erro ?? 'Erro');
    setMudar(null); router.refresh();
  }
  if (!itens.length) return <div className="vazio">Você ainda não enviou nada por aqui.</div>;
  return (
    <>
      {[...grupos.entries()].map(([mes, lista]) => (
        <section key={mes} className="flex flex-col gap-2">
          <h2 className="mes-cab" style={{ top: 'calc(var(--topo-h) + var(--safe-t))' }}>{mes}</h2>
          <div className="lista">
            {lista.map((i) => {
              const [st, txt] = ST[i.status] ?? ['recebido', 'Enviado'];
              return (
                <div key={i.id} className="linha flex-col">
                  <button className="flex items-start gap-3 text-left w-full" onClick={() => abrir(i.id)}>
                    <span className="flex-1 min-w-0">
                      <div className="linha-titulo">{i.nome}</div>
                      <div className="linha-sub flex items-center gap-1.5">{i.origem === 'whatsapp' ? <MessageCircle size={12} /> : <Smartphone size={12} />}{dataCurta(i.recebido_em)}{empresas.length > 1 ? ` · ${i.empresa}` : ''}</div>
                      {i.status === 'rejeitado' && i.motivo && <div className="text-[12.5px] text-[var(--warn-text)] mt-1">{i.motivo}</div>}
                    </span>
                    <Pilula status={st} texto={txt} />
                  </button>
                  {empresas.length > 1 && !['conferido', 'substituido'].includes(i.status) && (
                    <button className="btn btn-sm self-start mt-2" onClick={() => { setErro(null); setMudar(i); }}><Building2 size={13} />Mudar empresa</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <Modal aberto={Boolean(mudar)} aoFechar={() => setMudar(null)} titulo="Mudar empresa" subtitulo="Só enquanto o escritório não conferiu.">
        <div className="lista">
          {empresas.filter((e) => e.id !== mudar?.empresaId).map((e) => (
            <button key={e.id} className="linha" onClick={() => mover(e.id)}><span className="flex-1 text-left linha-titulo">{e.nome}</span></button>
          ))}
        </div>
        {erro && <div className="pill pill-danger pill-dot mt-3">{erro}</div>}
      </Modal>
    </>
  );
}
