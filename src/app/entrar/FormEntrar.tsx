'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, Mail } from 'lucide-react';
import { entrarComPasskey } from '@/lib/auth/passkey-cliente';

export function FormEntrar({ erro, destino }: { erro?: string; destino?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'passkey'>('idle');
  const [msg, setMsg] = useState<string | null>(erro ? mensagemDeErro(erro) : null);
  const [linkDev, setLinkDev] = useState<string | null>(null);

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando'); setMsg(null);
    const r = await fetch('/api/auth/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, destino }) });
    const j = await r.json();
    if (!r.ok) { setMsg(j.erro || 'Não foi possível enviar o link.'); setEstado('idle'); return; }
    setEstado('enviado');
    if (j.linkDev) setLinkDev(j.linkDev);
  }

  async function passkey() {
    setEstado('passkey'); setMsg(null);
    try {
      const r = await entrarComPasskey(email || undefined);
      router.push(r.destino ?? (r.tipo === 'cliente' ? '/cliente' : '/inicio'));
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message || 'Não foi possível entrar com a passkey.');
      setEstado('idle');
    }
  }

  if (estado === 'enviado') {
    return (
      <div className="card p-4 text-[13.5px]">
        <div className="font-medium mb-1">Link enviado</div>
        <p className="text-fg-3">Abra o e-mail <b className="text-fg">{email}</b> e toque no link para entrar. Ele vale por 30 minutos.</p>
        {linkDev && <a className="btn btn-sm mt-3" href={linkDev}>Abrir link (ambiente de desenvolvimento)</a>}
      </div>
    );
  }

  return (
    <form onSubmit={pedirLink} className="flex flex-col gap-3">
      <div className="campo">
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" className="input input-lg" type="email" required autoComplete="email webauthn" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
      </div>
      {msg && <div className="pill pill-danger pill-dot self-start gd-shake">{msg}</div>}
      <button className="btn btn-primary btn-lg w-full" type="submit" disabled={estado !== 'idle'}><Mail aria-hidden size={16} />{estado === 'enviando' ? 'Enviando…' : 'Receber link por e-mail'}</button>
      <button className="btn btn-lg w-full" type="button" onClick={passkey} disabled={estado !== 'idle'}><Fingerprint aria-hidden size={16} />Entrar com digital ou rosto</button>
    </form>
  );
}

function mensagemDeErro(cod: string): string {
  return ({
    'link-invalido': 'Este link não vale mais. Peça um novo.',
    'sessao-expirada': 'A sua sessão terminou. Entre de novo.',
    'inativo': 'Este acesso foi desativado. Fale com o escritório.',
  } as Record<string, string>)[cod] ?? 'Não foi possível entrar.';
}
