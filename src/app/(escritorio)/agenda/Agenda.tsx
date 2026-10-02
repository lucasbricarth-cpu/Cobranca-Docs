'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import type { Modelo } from '@/lib/agenda';

const PERFIS = [['simples', 'Simples'], ['presumido', 'Presumido'], ['mei', 'MEI'], ['folha', 'Com folha']] as const;
const comp = (n: number) => (n === 0 ? 'competência do próprio mês' : n === -1 ? 'competência do mês anterior' : `competência de ${-n} meses antes`);

interface ModeloEmpresa { id: string; perfil: string; tipo_nome: string; dia_criacao: number; dia_prazo: number; meses_competencia: number; modelo_ativo: boolean; ativo: boolean; dia_criacao_empresa: number | null; dia_prazo_empresa: number | null }

export function Agenda({ admin, modelos, tipos, empresas }: { admin: boolean; modelos: Modelo[]; tipos: { id: string; nome: string }[]; empresas: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [aba, setAba] = useState<'modelos' | 'empresa'>('modelos');
  const [edit, setEdit] = useState<Partial<Modelo> & { perfil: string } | null>(null);
  const [empresaId, setEmpresaId] = useState('');
  const [dados, setDados] = useState<{ empresa: { perfil: string; tem_folha: boolean }; modelos: ModeloEmpresa[] } | null>(null);

  const carregar = async (id: string) => { if (!id) return setDados(null); const r = await chamar<{ empresa: { perfil: string; tem_folha: boolean }; modelos: ModeloEmpresa[] }>(`/api/agenda/empresa/${id}`); if (r.ok) setDados(r); };
  useEffect(() => { carregar(empresaId); }, [empresaId]);

  async function salvarModelo() {
    if (!edit) return;
    const corpo = { perfil: edit.perfil, tipo_id: edit.tipo_id, dia_criacao: Number(edit.dia_criacao), dia_prazo: Number(edit.dia_prazo), meses_competencia: Number(edit.meses_competencia ?? -1), mensagem: edit.mensagem ?? null, ativo: edit.ativo ?? true };
    const r = edit.id ? await chamar(`/api/agenda/modelos/${edit.id}`, 'PATCH', corpo) : await chamar('/api/agenda/modelos', 'POST', corpo);
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    setEdit(null); router.refresh();
  }
  async function ajustar(corpo: Record<string, unknown>) {
    const r = await chamar(`/api/agenda/empresa/${empresaId}`, 'PUT', corpo);
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    carregar(empresaId);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="seg self-start">
        <button className={`seg-item ${aba === 'modelos' ? 'active' : ''}`} onClick={() => setAba('modelos')}>Modelos por perfil</button>
        <button className={`seg-item ${aba === 'empresa' ? 'active' : ''}`} onClick={() => setAba('empresa')}>Ajuste por empresa</button>
      </div>
      {aba === 'modelos' && PERFIS.map(([perfil, nome]) => (
        <section key={perfil}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="h2">{nome}</h2>
            {admin && <button className="btn btn-sm" onClick={() => setEdit({ perfil, dia_criacao: 1, dia_prazo: 5, meses_competencia: -1, tipo_id: tipos[0]?.id, ativo: true })}><Plus size={14} />Modelo</button>}
          </div>
          <div className="lista">
            {modelos.filter((m) => m.perfil === perfil).map((m) => (
              <button key={m.id} className="linha" disabled={!admin} onClick={() => setEdit({ ...m })}>
                <span className="flex-1 min-w-0">
                  <div className="linha-titulo">{m.tipo_nome}</div>
                  <div className="linha-sub">Nasce no dia {m.dia_criacao} · prazo dia {m.dia_prazo}{m.dia_prazo < m.dia_criacao ? ' do mês seguinte' : ''} · {comp(m.meses_competencia)}</div>
                </span>
                {!m.ativo && <span className="pill">Desligado</span>}
              </button>
            ))}
            {modelos.filter((m) => m.perfil === perfil).length === 0 && <div className="vazio">Nenhum modelo.</div>}
          </div>
        </section>
      ))}
      {aba === 'empresa' && (
        <section className="flex flex-col gap-3">
          <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} aria-label="Empresa">
            <option value="">Escolha a empresa…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {dados && (
            <>
              <div className="card p-4 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-[13px]">Perfil
                  <select className="input" style={{ width: 160 }} value={dados.empresa.perfil} onChange={(e) => ajustar({ perfil: e.target.value })}>
                    <option value="simples">Simples</option><option value="presumido">Presumido</option><option value="mei">MEI</option>
                  </select></label>
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="sw" checked={dados.empresa.tem_folha} onChange={(e) => ajustar({ temFolha: e.target.checked })} />Com folha</label>
              </div>
              <div className="lista">
                {dados.modelos.map((m) => (
                  <div key={m.id} className="linha flex-wrap">
                    <span className="flex-1 min-w-[180px]"><div className="linha-titulo">{m.tipo_nome}</div><div className="linha-sub">{m.perfil === 'folha' ? 'Com folha' : 'Perfil'} · {comp(m.meses_competencia)}</div></span>
                    <label className="text-[12px] flex items-center gap-1">Dia <input className="input mono" style={{ width: 64 }} type="number" min={1} max={31} placeholder={String(m.dia_criacao)} defaultValue={m.dia_criacao_empresa ?? ''}
                      onBlur={(e) => ajustar({ modelo: { id: m.id, ativo: m.ativo, dia_criacao: e.target.value ? Number(e.target.value) : null, dia_prazo: m.dia_prazo_empresa } })} /></label>
                    <label className="text-[12px] flex items-center gap-1">Prazo <input className="input mono" style={{ width: 64 }} type="number" min={1} max={31} placeholder={String(m.dia_prazo)} defaultValue={m.dia_prazo_empresa ?? ''}
                      onBlur={(e) => ajustar({ modelo: { id: m.id, ativo: m.ativo, dia_criacao: m.dia_criacao_empresa, dia_prazo: e.target.value ? Number(e.target.value) : null } })} /></label>
                    <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" className="sw" checked={m.ativo} onChange={(e) => ajustar({ modelo: { id: m.id, ativo: e.target.checked, dia_criacao: m.dia_criacao_empresa, dia_prazo: m.dia_prazo_empresa } })} />Pedir</label>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      <Modal aberto={Boolean(edit)} aoFechar={() => setEdit(null)} titulo={edit?.id ? 'Editar modelo' : 'Novo modelo'} subtitulo={PERFIS.find(([p]) => p === edit?.perfil)?.[1]}
        rodape={<>{edit?.id && <button className="btn btn-ghost mr-auto" onClick={async () => { await chamar(`/api/agenda/modelos/${edit.id}`, 'DELETE'); setEdit(null); router.refresh(); }}>Excluir</button>}
          <button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary" onClick={salvarModelo}>Salvar</button></>}>
        {edit && (
          <>
            <div className="campo"><label className="label" htmlFor="ag-tipo">Tipo</label>
              <select id="ag-tipo" className="input" value={edit.tipo_id} onChange={(e) => setEdit({ ...edit, tipo_id: e.target.value })}>{tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
            <div className="rg rg-2 mt-3">
              <div className="campo"><label className="label" htmlFor="ag-dc">Nasce no dia</label><input id="ag-dc" className="input mono" type="number" min={1} max={31} value={edit.dia_criacao ?? 1} onChange={(e) => setEdit({ ...edit, dia_criacao: Number(e.target.value) })} /></div>
              <div className="campo" style={{ marginTop: 0 }}><label className="label" htmlFor="ag-dp">Prazo no dia</label><input id="ag-dp" className="input mono" type="number" min={1} max={31} value={edit.dia_prazo ?? 5} onChange={(e) => setEdit({ ...edit, dia_prazo: Number(e.target.value) })} /></div>
            </div>
            <div className="campo"><label className="label" htmlFor="ag-mc">Competência</label>
              <select id="ag-mc" className="input" value={edit.meses_competencia ?? -1} onChange={(e) => setEdit({ ...edit, meses_competencia: Number(e.target.value) })}>
                <option value={-1}>Mês anterior ao pedido</option><option value={0}>O próprio mês</option><option value={-2}>Dois meses antes</option>
              </select></div>
            <div className="campo"><label className="label" htmlFor="ag-msg">Mensagem (opcional)</label><textarea id="ag-msg" className="input" value={edit.mensagem ?? ''} onChange={(e) => setEdit({ ...edit, mensagem: e.target.value })} /></div>
            <label className="flex items-center justify-between gap-3 text-[13px] mt-3">Ativo<input type="checkbox" className="sw" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} /></label>
          </>
        )}
      </Modal>
      {toast}
    </div>
  );
}
