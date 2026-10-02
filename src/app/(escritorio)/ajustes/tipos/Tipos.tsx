'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Lock } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { IconeTipo, ICONES_TIPO } from '@/components/ui/IconeTipo';
import type { Tipo } from '@/lib/documentos/tipos';

const ORIGENS = { '': 'Sem subtipo', contas: 'Contas bancárias (da Domínio)', cartoes: 'Cartões (4 últimos dígitos)', livre: 'Livres (criados pelo escritório)' } as const;
const VAZIO = { nome: '', subtipo_origem: '' as '' | 'contas' | 'cartoes' | 'livre', regra_mes: 'anterior' as 'anterior' | 'atual', sensivel: false, guarda_meses: 60, icone: 'file-text', ativo: true };

export function Tipos({ tipos }: { tipos: Tipo[] }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [edit, setEdit] = useState<{ id?: string; f: typeof VAZIO } | null>(null);

  async function salvar() {
    if (!edit) return;
    const corpo = { ...edit.f, subtipo_origem: edit.f.subtipo_origem || null };
    const r = edit.id ? await chamar(`/api/tipos/${edit.id}`, 'PATCH', corpo) : await chamar('/api/tipos', 'POST', corpo);
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    setEdit(null); router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setEdit({ f: { ...VAZIO } })}><Plus size={15} />Novo tipo</button></div>
      <div className="lista">
        {tipos.map((t) => (
          <button key={t.id} className="linha" onClick={() => setEdit({ id: t.id, f: { nome: t.nome, subtipo_origem: t.subtipo_origem ?? '', regra_mes: t.regra_mes, sensivel: t.sensivel, guarda_meses: t.guarda_meses, icone: t.icone, ativo: t.ativo } })}>
            <span className="icone-id neutro"><IconeTipo nome={t.icone} sensivel={t.sensivel} /></span>
            <span className="flex-1 min-w-0">
              <div className="linha-titulo flex items-center gap-1.5">{t.nome}{t.sensivel && <Lock size={12} aria-label="Sensível" />}</div>
              <div className="linha-sub">{ORIGENS[t.subtipo_origem ?? '']} · sem pedido: {t.regra_mes === 'anterior' ? 'mês anterior ao envio' : 'mês do envio'} · guarda {t.guarda_meses} meses</div>
            </span>
            {!t.ativo && <span className="pill">Inativo</span>}
          </button>
        ))}
      </div>
      <Modal aberto={Boolean(edit)} aoFechar={() => setEdit(null)} titulo={edit?.id ? 'Editar tipo' : 'Novo tipo'}
        rodape={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary" disabled={!edit?.f.nome} onClick={salvar}>Salvar</button></>}>
        {edit && (
          <>
            <div className="campo"><label className="label" htmlFor="tp-nome">Nome</label><input id="tp-nome" className="input" value={edit.f.nome} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, nome: e.target.value } })} /></div>
            <div className="campo"><label className="label" htmlFor="tp-sub">Subtipos</label>
              <select id="tp-sub" className="input" value={edit.f.subtipo_origem} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, subtipo_origem: e.target.value as typeof VAZIO.subtipo_origem } })}>
                {Object.entries(ORIGENS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select></div>
            <div className="campo"><label className="label" htmlFor="tp-regra">Mês para envio sem pedido</label>
              <select id="tp-regra" className="input" value={edit.f.regra_mes} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, regra_mes: e.target.value as 'anterior' | 'atual' } })}>
                <option value="anterior">Mês anterior ao envio</option><option value="atual">Mês do envio</option>
              </select></div>
            <div className="campo"><label className="label" htmlFor="tp-guarda">Prazo de guarda (meses)</label>
              <input id="tp-guarda" className="input mono" type="number" min={1} max={1200} value={edit.f.guarda_meses} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, guarda_meses: Number(e.target.value) } })} /></div>
            <div className="campo"><label className="label" htmlFor="tp-icone">Ícone</label>
              <select id="tp-icone" className="input" value={edit.f.icone} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, icone: e.target.value } })}>
                {ICONES_TIPO.map((i) => <option key={i} value={i}>{i}</option>)}
              </select></div>
            <label className="flex items-center justify-between gap-3 text-[13px] mt-3">Sensível (saúde de funcionário, sindical e afins)<input type="checkbox" className="sw" checked={edit.f.sensivel} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, sensivel: e.target.checked } })} /></label>
            <label className="flex items-center justify-between gap-3 text-[13px] mt-3">Ativo<input type="checkbox" className="sw" checked={edit.f.ativo} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, ativo: e.target.checked } })} /></label>
          </>
        )}
      </Modal>
      {toast}
    </div>
  );
}
