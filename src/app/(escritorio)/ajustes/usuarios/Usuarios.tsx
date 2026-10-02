'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { chamar } from '@/components/ui/cliente-http';

interface U { id: string; nome: string; email: string; papel: 'admin' | 'funcionario'; ativo: boolean; i_responsavel_dominio: number | null; empresas: number }

export function Usuarios({ usuarios, meuId }: { usuarios: U[]; meuId: string }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ nome: '', email: '', papel: 'funcionario' as 'admin' | 'funcionario', i: '' });

  async function salvar() {
    const r = await chamar('/api/usuarios', 'POST', { nome: f.nome, email: f.email, papel: f.papel, iResponsavel: f.i ? Number(f.i) : null });
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    setAberto(false); setF({ nome: '', email: '', papel: 'funcionario', i: '' });
    avisar('Funcionário cadastrado. Ele entra pelo link no e-mail.');
    router.refresh();
  }
  async function alterar(id: string, d: Record<string, unknown>) {
    const r = await chamar(`/api/usuarios/${id}`, 'PATCH', d);
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setAberto(true)}><UserPlus size={15} />Novo funcionário</button></div>
      <div className="lista">
        {usuarios.map((u) => (
          <div key={u.id} className="linha flex-wrap">
            <span className="flex-1 min-w-[180px]">
              <div className="linha-titulo">{u.nome}{u.id === meuId ? ' (você)' : ''}</div>
              <div className="linha-sub">{u.email} · <span className="mono">{u.empresas}</span> empresas{u.i_responsavel_dominio ? <> · Domínio <span className="mono">#{u.i_responsavel_dominio}</span></> : null}</div>
            </span>
            <select className="input" style={{ width: 150 }} aria-label={`Papel de ${u.nome}`} value={u.papel} disabled={u.id === meuId} onChange={(e) => alterar(u.id, { papel: e.target.value })}>
              <option value="funcionario">Funcionário</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn btn-sm" disabled={u.id === meuId} onClick={() => alterar(u.id, { ativo: !u.ativo })}>{u.ativo ? 'Desativar' : 'Reativar'}</button>
          </div>
        ))}
      </div>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo funcionário" icone={<UserPlus />}
        rodape={<><button className="btn" onClick={() => setAberto(false)}>Cancelar</button><button className="btn btn-primary" disabled={!f.nome || !f.email} onClick={salvar}>Cadastrar</button></>}>
        <div className="campo"><label className="label" htmlFor="u-nome">Nome</label><input id="u-nome" className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
        <div className="campo"><label className="label" htmlFor="u-email">E-mail</label><input id="u-email" type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="campo"><label className="label" htmlFor="u-papel">Papel</label>
          <select id="u-papel" className="input" value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value as 'admin' | 'funcionario' })}><option value="funcionario">Funcionário</option><option value="admin">Admin</option></select></div>
        <div className="campo"><label className="label" htmlFor="u-i">Código de responsável na Domínio (I_RESPONSAVEL)</label><input id="u-i" inputMode="numeric" className="input mono" value={f.i} onChange={(e) => setF({ ...f, i: e.target.value.replace(/\D/g, '') })} /></div>
      </Modal>
      {toast}
    </div>
  );
}
