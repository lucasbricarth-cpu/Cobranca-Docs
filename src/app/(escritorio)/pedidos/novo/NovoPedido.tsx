'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Search } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { useToast } from '@/components/ui/Toast';
import { normalizarBusca } from '@/lib/texto';

interface Empresa { id: string; nome: string; perfil: string; tem_folha: boolean; responsavel_id: string | null }
interface Tipo { id: string; nome: string; subtipo_origem: string | null; regra_mes: string }

export function NovoPedido({ tipos, empresas, competenciaPadrao, empresaInicial }: { tipos: Tipo[]; empresas: Empresa[]; competenciaPadrao: string; empresaInicial?: string }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [sel, setSel] = useState<string[]>(empresaInicial ? [empresaInicial] : []);
  const [busca, setBusca] = useState('');
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? '');
  const [subs, setSubs] = useState<{ id: string; rotulo: string; ativo: boolean }[]>([]);
  const [subsSel, setSubsSel] = useState<string[] | 'todos'>('todos');
  const [mes, setMes] = useState(competenciaPadrao.slice(0, 7));
  const [prazo, setPrazo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const tipo = tipos.find((t) => t.id === tipoId);

  useEffect(() => {
    setSubs([]); setSubsSel('todos');
    if (sel.length !== 1 || !tipo?.subtipo_origem) return;
    chamar<{ subtipos: { id: string; rotulo: string; ativo: boolean }[] }>(`/api/empresas/${sel[0]}/subtipos?tipo=${tipoId}`).then((r) => setSubs((r.subtipos ?? []).filter((x) => x.ativo)));
  }, [sel, tipoId, tipo?.subtipo_origem]);

  const filtradas = useMemo(() => {
    const b = normalizarBusca(busca);
    return b ? empresas.filter((e) => normalizarBusca(e.nome).includes(b)) : empresas;
  }, [busca, empresas]);

  async function enviar() {
    setEnviando(true);
    const r = await chamar<{ itensCriados: number; jaExistiam: number; pedidoId: string; empresasSemSubtipo: string[] }>('/api/pedidos', 'POST', {
      empresaIds: sel, tipoId, subtipos: subsSel, competencia: `${mes}-01`, prazo: prazo || null, mensagem: mensagem || null,
    });
    setEnviando(false);
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    const extra = [r.jaExistiam ? `${r.jaExistiam} já existiam` : '', r.empresasSemSubtipo.length ? `${r.empresasSemSubtipo.length} empresa(s) sem conta/cartão cadastrado` : ''].filter(Boolean).join(' · ');
    avisar(`${r.itensCriados} item(ns) pedido(s).${extra ? ` ${extra}.` : ''}`);
    router.push(`/pedidos/${r.pedidoId}`);
  }

  const marcarPerfil = (f: (e: Empresa) => boolean) => setSel(empresas.filter(f).map((e) => e.id));

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between"><div className="eyebrow">Empresas</div><span className="mono text-[12px] text-fg-3">{sel.length} escolhida{sel.length === 1 ? '' : 's'}</span></div>
        <div className="chips">
          <button type="button" className="chip" onClick={() => marcarPerfil((e) => e.perfil === 'simples')}>Simples</button>
          <button type="button" className="chip" onClick={() => marcarPerfil((e) => e.perfil === 'presumido')}>Presumido</button>
          <button type="button" className="chip" onClick={() => marcarPerfil((e) => e.perfil === 'mei')}>MEI</button>
          <button type="button" className="chip" onClick={() => marcarPerfil((e) => e.tem_folha)}>Com folha</button>
          <button type="button" className="chip" onClick={() => setSel([])}>Limpar</button>
        </div>
        <div className="input-group"><span className="input-icon"><Search size={15} /></span><input className="input input-search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa" aria-label="Buscar empresa" /></div>
        <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
          {filtradas.map((e) => (
            <label key={e.id} className="flex items-center gap-2.5 px-2 py-2 rounded-[10px] hover:bg-[var(--glass-3)] text-[13.5px] cursor-pointer">
              <input type="checkbox" className="sw" checked={sel.includes(e.id)} onChange={(ev) => setSel(ev.target.checked ? [...sel, e.id] : sel.filter((x) => x !== e.id))} />
              {e.nome}
            </label>
          ))}
        </div>
      </section>
      <section className="card p-4 flex flex-col gap-3">
        <div className="campo"><label className="label" htmlFor="np-tipo">Tipo</label>
          <select id="np-tipo" className="input" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>{tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
        {tipo?.subtipo_origem && (
          <div className="campo">
            <span className="label">{tipo.subtipo_origem === 'contas' ? 'Contas' : tipo.subtipo_origem === 'cartoes' ? 'Cartões' : 'Subtipos'}</span>
            <div className="chips">
              <button type="button" className={`chip ${subsSel === 'todos' ? 'active' : ''}`} onClick={() => setSubsSel('todos')}>{tipo.subtipo_origem === 'contas' ? 'Todas as contas da empresa' : 'Todos'}</button>
              {sel.length === 1 && subs.map((x) => {
                const on = Array.isArray(subsSel) && subsSel.includes(x.id);
                return <button key={x.id} type="button" className={`chip ${on ? 'active' : ''}`} onClick={() => setSubsSel(on ? (subsSel as string[]).filter((y) => y !== x.id).length ? (subsSel as string[]).filter((y) => y !== x.id) : 'todos' : [...(Array.isArray(subsSel) ? subsSel : []), x.id])}>{x.rotulo}</button>;
              })}
            </div>
            {sel.length > 1 && <span className="text-[12px] text-fg-3">Com várias empresas, o pedido vai para todas as contas ativas de cada uma.</span>}
          </div>
        )}
        <div className="rg rg-2">
          <div className="campo"><label className="label" htmlFor="np-mes">Competência</label><input id="np-mes" type="month" className="input" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
          <div className="campo" style={{ marginTop: 0 }}><label className="label" htmlFor="np-prazo">Prazo</label><input id="np-prazo" type="date" className="input" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
        </div>
        <div className="campo"><label className="label" htmlFor="np-msg">Mensagem ao cliente (opcional)</label><textarea id="np-msg" className="input" value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: inclua também a conta poupança, por favor." /></div>
      </section>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={() => router.back()}>Cancelar</button>
        <button className="btn btn-primary" disabled={!sel.length || !tipoId || !mes || enviando} onClick={enviar}><Send size={15} />{enviando ? 'Pedindo…' : `Pedir a ${sel.length} empresa${sel.length === 1 ? '' : 's'}`}</button>
      </div>
      {toast}
    </div>
  );
}
