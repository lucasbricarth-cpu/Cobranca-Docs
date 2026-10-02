'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, LogOut, Download } from 'lucide-react';
import { cadastrarPasskey } from '@/lib/auth/passkey-cliente';
import { useToast } from '@/components/ui/Toast';
import { AtivarAvisos } from '@/components/pwa/AtivarAvisos';

export function Conta({ temPasskey }: { temPasskey: boolean }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [ok, setOk] = useState(temPasskey);
  async function passkey() {
    try {
      if (await cadastrarPasskey()) { setOk(true); avisar('Pronto! Na próxima vez, entre com a digital ou o rosto.'); }
    } catch (e) { avisar((e as Error).message || 'Não foi possível cadastrar.', 'erro'); }
  }
  async function sair() {
    await fetch('/api/auth/sair', { method: 'POST' });
    router.push('/entrar');
  }
  return (
    <>
      <section className="card p-4 flex flex-col gap-3">
        <div className="eyebrow">Entrar sem senha</div>
        <p className="text-[13.5px] text-fg-2">{ok ? 'Você já entra com a digital ou o rosto neste aparelho.' : 'Cadastre a digital ou o rosto para entrar sem esperar o e-mail.'}</p>
        <button className={`btn ${ok ? '' : 'btn-primary'} btn-lg`} onClick={passkey}><Fingerprint size={16} />{ok ? 'Cadastrar outro aparelho' : 'Cadastrar digital ou rosto'}</button>
      </section>
      <AtivarAvisos />
      <section className="card p-4 flex flex-col gap-3">
        <div className="eyebrow">App no celular</div>
        <a href="/instalar" className="btn btn-lg"><Download size={16} />Como instalar</a>
      </section>
      <button className="btn btn-ghost self-start" onClick={sair}><LogOut size={15} />Sair</button>
      {toast}
    </>
  );
}
