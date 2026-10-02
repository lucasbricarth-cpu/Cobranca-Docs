'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Fingerprint, Building2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { chamar } from '@/components/ui/cliente-http';

interface Login { id: string; nome: string; email: string; ativo: boolean; passkeys: number; outras: number }

export function Acessos({ empresaId, logins, sugestoes, outrasEmpresas }: {
  empresaId: string; logins: Login[]; sugestoes: { nome: string; email: string }[]; outrasEmpresas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [outras, setOutras] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [linkDev, setLinkDev] = useState<string | null>(null);

  async function convidar() {
    setEnviando(true);
    const r = await chamar<{ linkDev?: string }>(`/api/empresas/${empresaId}/logins`, 'POST', { nome, email, outrasEmpresas: outras });
    setEnviando(false);
    if (!r.ok) return avisar(r.erro ?? 'Não foi possível convidar.', 'erro');
    setAberto(false); setNome(''); setEmail(''); setOutras([]);
    if (r.linkDev) setLinkDev(r.linkDev);
    avisar('Convite enviado por e-mail.');
    router.refresh();
  }
  async function alternar(l: Login) {
    if (l.ativo && !confirm(`Desativar o acesso de ${l.nome}? Os arquivos que ele mandou continuam guardados.`)) return;
    const r = await chamar(`/api/logins/${l.id}`, 'PATCH', { ativo: !l.ativo });
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    avisar(l.ativo ? 'Acesso desativado.' : 'Acesso reativado.');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setAberto(true)}><UserPlus size={15} />Convidar contato</button></div>
      {linkDev && <div className="card p-3 text-[12.5px]">Ambiente de desenvolvimento: <a className="texto-destaque underline break-all" href={linkDev}>link do convite</a></div>}
      <div className="lista">
        {logins.length === 0 && <div className="vazio">Ninguém desta empresa tem acesso ainda.</div>}
        {logins.map((l) => (
          <div key={l.id} className="linha">
            <span className="flex-1 min-w-0">
              <div className="linha-titulo">{l.nome}</div>
              <div className="linha-sub truncate">{l.email}</div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {l.passkeys > 0 && <span className="pill"><Fingerprint />Passkey</span>}
                {l.outras > 0 && <span className="pill"><Building2 />+{l.outras} empresa{l.outras > 1 ? 's' : ''}</span>}
                {!l.ativo && <span className="pill st-atrasado">Desativado</span>}
              </div>
            </span>
            <button className="btn btn-sm" onClick={() => alternar(l)}>{l.ativo ? 'Desativar' : 'Reativar'}</button>
          </div>
        ))}
      </div>
      {sugestoes.length > 0 && (
        <section>
          <div className="eyebrow mb-2">Contatos da Domínio (sugestão)</div>
          <div className="lista">
            {sugestoes.map((c) => (
              <button key={c.email} className="linha" onClick={() => { setNome(c.nome); setEmail(c.email); setAberto(true); }}>
                <span className="flex-1 min-w-0"><div className="linha-titulo">{c.nome || c.email}</div><div className="linha-sub">{c.email}</div></span>
                <span className="text-[12px] texto-destaque">Convidar</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Convidar contato" subtitulo="O contato recebe um link por e-mail e entra já ligado às empresas escolhidas." icone={<UserPlus />}
        rodape={<><button className="btn" onClick={() => setAberto(false)}>Cancelar</button><button className="btn btn-primary" disabled={enviando || !nome || !email} onClick={convidar}>{enviando ? 'Enviando…' : 'Enviar convite'}</button></>}>
        <div className="campo"><label className="label" htmlFor="cv-nome">Nome</label><input id="cv-nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="campo"><label className="label" htmlFor="cv-email">E-mail</label><input id="cv-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {outrasEmpresas.length > 0 && (
          <div className="campo">
            <label className="label" htmlFor="cv-outras">Também tem acesso a (opcional)</label>
            <select id="cv-outras" className="input" multiple size={Math.min(5, outrasEmpresas.length)} value={outras} onChange={(e) => setOutras([...e.target.selectedOptions].map((o) => o.value))} style={{ height: 'auto', padding: 8 }}>
              {outrasEmpresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}
      </Modal>
      {toast}
    </div>
  );
}
