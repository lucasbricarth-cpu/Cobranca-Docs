'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';

interface Grupo { tipo: { id: string; nome: string; origem: 'contas' | 'cartoes' | 'livre' }; itens: { id: string; rotulo: string; apelido: string | null; ativo: boolean; encerrada: boolean }[] }

export function Subtipos({ empresaId, grupos }: { empresaId: string; grupos: Grupo[] }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [novo, setNovo] = useState<Grupo['tipo'] | null>(null);
  const [f, setF] = useState({ final: '', emissor: '', nome: '' });
  const [renomear, setRenomear] = useState<{ id: string; nome: string } | null>(null);

  async function criar() {
    if (!novo) return;
    const corpo = novo.origem === 'cartoes' ? { tipoId: novo.id, cartaoFinal: f.final, emissor: f.emissor } : { tipoId: novo.id, nome: f.nome };
    const r = await chamar(`/api/empresas/${empresaId}/subtipos`, 'POST', corpo);
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    setNovo(null); setF({ final: '', emissor: '', nome: '' }); router.refresh();
  }
  async function alterar(id: string, d: Record<string, unknown>) {
    const r = await chamar(`/api/subtipos/${id}`, 'PATCH', d);
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {grupos.map((g) => (
        <section key={g.tipo.id}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="h2">{g.tipo.nome}</h2>
            {g.tipo.origem !== 'contas' && <button className="btn btn-sm" onClick={() => setNovo(g.tipo)}><Plus size={14} />{g.tipo.origem === 'cartoes' ? 'Cartão' : 'Subtipo'}</button>}
          </div>
          <div className="lista">
            {g.itens.length === 0 && <div className="vazio">{g.tipo.origem === 'contas' ? 'Nenhuma conta veio da Domínio.' : 'Nenhum cadastrado.'}</div>}
            {g.itens.map((x) => (
              <div key={x.id} className="linha">
                <span className="flex-1 min-w-0">
                  <div className="linha-titulo">{x.rotulo}</div>
                  <div className="linha-sub">{x.ativo ? 'Pedindo todo mês' : 'Não pedir'}{x.encerrada ? ' · encerrada na Domínio' : ''}</div>
                </span>
                {g.tipo.origem !== 'cartoes' && <button className="btn btn-sm btn-ghost" onClick={() => setRenomear({ id: x.id, nome: x.apelido ?? (g.tipo.origem === 'livre' ? x.rotulo : '') })}>Renomear</button>}
                <button className="btn btn-sm" onClick={() => alterar(x.id, { ativo: !x.ativo })}>{x.ativo ? 'Parar de pedir' : 'Voltar a pedir'}</button>
              </div>
            ))}
          </div>
        </section>
      ))}
      <Modal aberto={Boolean(novo)} aoFechar={() => setNovo(null)} titulo={novo?.origem === 'cartoes' ? 'Novo cartão' : 'Novo subtipo'} subtitulo={novo?.nome}
        rodape={<><button className="btn" onClick={() => setNovo(null)}>Cancelar</button><button className="btn btn-primary" onClick={criar}>Salvar</button></>}>
        {novo?.origem === 'cartoes' ? (
          <>
            <div className="campo"><label className="label" htmlFor="st-final">4 últimos dígitos</label>
              <input id="st-final" className="input mono" inputMode="numeric" maxLength={4} value={f.final} onChange={(e) => setF({ ...f, final: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></div>
            <div className="campo"><label className="label" htmlFor="st-emissor">Emissor (opcional)</label>
              <input id="st-emissor" className="input" placeholder="Itaú, Nubank…" value={f.emissor} onChange={(e) => setF({ ...f, emissor: e.target.value })} /></div>
          </>
        ) : (
          <div className="campo"><label className="label" htmlFor="st-nome">Nome</label><input id="st-nome" className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
        )}
      </Modal>
      <Modal aberto={Boolean(renomear)} aoFechar={() => setRenomear(null)} titulo="Renomear" subtitulo="Todos os nomes de arquivo se atualizam sozinhos."
        rodape={<><button className="btn" onClick={() => setRenomear(null)}>Cancelar</button><button className="btn btn-primary" onClick={async () => { await alterar(renomear!.id, { nome: renomear!.nome || null }); setRenomear(null); }}>Salvar</button></>}>
        <div className="campo"><label className="label" htmlFor="st-ren">Nome (vazio = automático)</label><input id="st-ren" className="input" value={renomear?.nome ?? ''} onChange={(e) => setRenomear(renomear ? { ...renomear, nome: e.target.value } : null)} /></div>
      </Modal>
      {toast}
    </div>
  );
}
