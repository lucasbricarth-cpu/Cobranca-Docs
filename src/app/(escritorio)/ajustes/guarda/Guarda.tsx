'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Trash2, ShieldCheck } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { dataCurta } from '@/lib/tempo';

interface Doc {
  id: string; motivo: 'guarda' | 'pasta_geral'; vence_em: string; nome: string; empresa_nome: string | null; tipo_nome: string | null;
  competencia: string | null; recebido_em: string; whatsapp_numero: string | null; sensivel: boolean; guarda_meses: number | null;
}
interface Exclusao { id: string; motivo: string; empresa: string | null; quantidade: number; aprovado_por: string; aprovado_em: string }
type Aba = 'guarda' | 'pasta' | 'avencer' | 'historico';
const MOTIVOS: Record<string, string> = { guarda: 'Prazo de guarda', pasta_geral: 'Pasta geral', saida_cliente: 'Saída de cliente' };

export function Guarda({ vencidosGuarda, vencidosPasta, aVencer, historico }: { vencidosGuarda: Doc[]; vencidosPasta: Doc[]; aVencer: Doc[]; historico: Exclusao[] }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [aba, setAba] = useState<Aba>(vencidosGuarda.length || !vencidosPasta.length ? 'guarda' : 'pasta');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const lista = aba === 'guarda' ? vencidosGuarda : aba === 'pasta' ? vencidosPasta : aba === 'avencer' ? aVencer : [];
  const selecionaveis = aba === 'guarda' || aba === 'pasta';
  const escolhidos = lista.filter((d) => sel.has(d.id));

  function trocar(a: Aba) { setAba(a); setSel(new Set()); setErro(null); }
  function alternar(id: string) { setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function aprovar() {
    setErro(null);
    const r = await chamar<{ excluidos: number }>('/api/guarda/aprovar', 'POST', { ids: escolhidos.map((d) => d.id), motivo: aba === 'guarda' ? 'guarda' : 'pasta_geral' });
    if (!r.ok) return setErro(r.erro ?? 'Erro');
    setConfirmar(false); setCiente(false); setSel(new Set());
    avisar(`${r.excluidos} arquivo(s) excluídos.`);
    router.refresh();
  }

  const abas: [Aba, string, number | null][] = [
    ['guarda', 'Guarda vencida', vencidosGuarda.length], ['pasta', 'Pasta geral vencida', vencidosPasta.length],
    ['avencer', 'A vencer', aVencer.length], ['historico', 'Histórico', null],
  ];
  return (
    <section className="flex flex-col gap-3">
      <div className="seg self-start max-w-full overflow-x-auto" role="tablist">
        {abas.map(([id, rotulo, n]) => (
          <button key={id} role="tab" aria-selected={aba === id} className={`seg-item ${aba === id ? 'active' : ''}`} onClick={() => trocar(id)}>
            {rotulo}{n !== null && <span className="mono ml-1.5 text-fg-4">{n}</span>}
          </button>
        ))}
      </div>

      {aba === 'historico' ? (
        historico.length ? (
          <div className="lista">
            {historico.map((h) => (
              <div key={h.id} className="linha">
                <span className="icone-id neutro"><ShieldCheck size={16} /></span>
                <span className="flex-1 min-w-0">
                  <div className="linha-titulo">{MOTIVOS[h.motivo] ?? h.motivo}{h.empresa ? ` · ${h.empresa}` : ''}</div>
                  <div className="linha-sub">Aprovado por {h.aprovado_por} em {dataCurta(h.aprovado_em, true)}</div>
                </span>
                <span className="mono text-[13px]">{h.quantidade}</span>
              </div>
            ))}
          </div>
        ) : <div className="vazio">Nenhuma exclusão aprovada ainda.</div>
      ) : (
        <>
          {aba === 'avencer' && <p className="text-[12.5px] text-fg-3">Arquivos sem empresa que vencem em breve. Classifique o que for de alguma empresa antes do vencimento: ao ganhar empresa, passa a valer o prazo do tipo.</p>}
          {selecionaveis && lista.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-[12.5px] text-fg-3">
                <input type="checkbox" className="selecao" checked={escolhidos.length === lista.length} onChange={(e) => setSel(e.target.checked ? new Set(lista.map((d) => d.id)) : new Set())} />
                Selecionar todos
              </label>
              <span className="flex-1" />
              <button className="btn btn-primary" disabled={!escolhidos.length} onClick={() => { setErro(null); setConfirmar(true); }}>
                <Trash2 size={15} />Aprovar exclusão{escolhidos.length ? ` (${escolhidos.length})` : ''}
              </button>
            </div>
          )}
          {lista.length ? (
            <div className="lista">
              {lista.map((d) => (
                <label key={d.id} className={`linha ${sel.has(d.id) ? 'is-on' : ''} ${selecionaveis ? 'cursor-pointer' : ''}`}>
                  {selecionaveis && <input type="checkbox" className="selecao" checked={sel.has(d.id)} onChange={() => alternar(d.id)} aria-label={`Selecionar ${d.nome}`} />}
                  <span className="flex-1 min-w-0">
                    <div className="linha-titulo flex items-center gap-1.5 truncate">{d.sensivel && <Lock size={12} aria-label="Sensível" />}{d.nome}</div>
                    <div className="linha-sub truncate">
                      {d.empresa_nome ?? (d.whatsapp_numero ? `Sem empresa · WhatsApp ${d.whatsapp_numero}` : 'Sem empresa')}
                      {' · '}recebido em {dataCurta(d.recebido_em, true)}
                      {d.motivo === 'guarda' && d.guarda_meses ? ` · guarda de ${d.guarda_meses} meses` : ''}
                    </div>
                  </span>
                  <span className={`pill pill-dot ${aba === 'avencer' ? 'pill-warn' : 'pill-danger'}`}>{aba === 'avencer' ? 'vence' : 'venceu'} {dataCurta(d.vence_em, true)}</span>
                </label>
              ))}
            </div>
          ) : <div className="vazio">{aba === 'avencer' ? 'Nada vence nos próximos dias.' : 'Nada vencido. Nada a aprovar.'}</div>}
        </>
      )}

      <Modal aberto={confirmar} aoFechar={() => setConfirmar(false)} titulo="Aprovar exclusão" icone={<Trash2 />}
        subtitulo={`${escolhidos.length} arquivo(s). O arquivo e a miniatura são apagados de vez.`}
        rodape={<><button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button><button className="btn btn-primary" disabled={!ciente} onClick={aprovar}>Excluir de vez</button></>}>
        <p className="text-[13px] text-fg-2">Fica registrado quem aprovou e quando. O nome do arquivo e o resto do conteúdo saem do sistema; só fica a contagem no histórico.</p>
        <label className="flex items-center gap-2 text-[13px] mt-3"><input type="checkbox" className="selecao" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />Entendo que não tem volta.</label>
        {erro && <div className="pill pill-danger pill-dot mt-3">{erro}</div>}
      </Modal>
      {toast}
    </section>
  );
}
