'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageCircle, ExternalLink } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { Modal } from '@/components/ui/Modal';

type Contato = { id: string; nome: string; email: string; ativo: boolean };
type Previa = { url: string; numero: string; texto: string; confirmado: boolean; nome: string };

/** "+55 11 98888-7777" para leitura; o wa.me usa só os dígitos. */
function foneLegivel(n: string) {
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : n;
}

/**
 * Cancelar o item e a reserva "Abrir no WhatsApp": wa.me com a mensagem e o
 * link de envio já preenchidos. O atendente vê a mensagem antes e abre por
 * um link de verdade (window.open depois de um await é bloqueado no celular).
 */
export function AcoesItem({ itemId, empresaId, podeCancelar, aberto }: { itemId: string; empresaId: string; podeCancelar: boolean; aberto: boolean }) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [contatos, setContatos] = useState<Contato[] | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fechar = () => { setModal(false); setContatos(null); setPrevia(null); setErro(null); };

  async function prever(c: Contato) {
    setErro(null);
    const r = await chamar<Omit<Previa, 'nome'>>('/api/whatsapp/abrir', 'POST', { itemId, loginId: c.id });
    if (!r.ok) return setErro(r.erro ?? 'Erro');
    setPrevia({ url: r.url, numero: r.numero, texto: r.texto, confirmado: r.confirmado, nome: c.nome });
  }
  async function iniciar() {
    setModal(true);
    const r = await chamar<{ logins: Contato[] }>(`/api/empresas/${empresaId}/logins`);
    const ativos = (r.logins ?? []).filter((l) => l.ativo);
    setContatos(ativos);
    if (ativos.length === 1) await prever(ativos[0]);
  }
  return (
    <>
      {aberto && <button className="btn btn-ghost btn-icon" aria-label="Abrir no WhatsApp" title="Abrir no WhatsApp" onClick={iniciar}><MessageCircle size={15} /></button>}
      {podeCancelar && (
        <button className="btn btn-ghost btn-icon" aria-label="Cancelar item" title="Cancelar este item" onClick={async () => {
          if (!confirm('Cancelar este item? Ele sai do checklist e os lembretes param.')) return;
          await chamar(`/api/itens/${itemId}`, 'PATCH', { cancelar: true });
          router.refresh();
        }}><X size={15} /></button>
      )}
      <Modal aberto={modal} aoFechar={fechar} titulo="Abrir no WhatsApp" icone={<MessageCircle size={16} />}
        subtitulo={previa ? `Para ${previa.nome}${previa.numero ? ` · ${foneLegivel(previa.numero)}` : ''}` : 'Para qual contato? A mensagem e o link já vão preenchidos.'}
        rodape={previa ? (
          <>
            {(contatos?.length ?? 0) > 1 && <button className="btn" onClick={() => setPrevia(null)}>Outro contato</button>}
            <a className="btn btn-primary" href={previa.url} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(fechar, 300)}><ExternalLink size={15} /> Abrir no WhatsApp</a>
          </>
        ) : undefined}>
        {previa ? (
          <>
            <div className="card p-3 text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{previa.texto}</div>
            {!previa.numero && <div className="pill pill-warn pill-dot mt-3">Sem número confirmado: o WhatsApp vai pedir o contato.</div>}
            {previa.numero && !previa.confirmado && <div className="pill pill-warn pill-dot mt-3">Número do cadastro da empresa, ainda não confirmado em Acessos.</div>}
          </>
        ) : (
          <div className="lista">
            {contatos === null && <div className="vazio">Carregando…</div>}
            {contatos?.length === 0 && <div className="vazio">Ninguém desta empresa tem acesso. Convide em Acessos.</div>}
            {contatos?.map((c) => <button key={c.id} className="linha" onClick={() => prever(c)}><span className="flex-1 text-left"><div className="linha-titulo">{c.nome}</div><div className="linha-sub">{c.email}</div></span></button>)}
          </div>
        )}
        {erro && <div className="pill pill-danger pill-dot mt-3">{erro}</div>}
      </Modal>
    </>
  );
}
