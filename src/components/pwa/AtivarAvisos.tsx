'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

/**
 * Ativa o Web Push (VAPID). No iPhone só funciona com o app adicionado à
 * Tela de Início (iOS 16.4+). Quem não ativar recebe pelo e-mail.
 */
function base64ParaUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function AtivarAvisos() {
  const [estado, setEstado] = useState<'carregando' | 'sem-suporte' | 'iphone-instalar' | 'ativo' | 'inativo' | 'negado'>('carregando');
  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setEstado(ios && !instalado ? 'iphone-instalar' : 'sem-suporte');
      if (Notification.permission === 'denied') return setEstado('negado');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? 'ativo' : 'inativo');
    })().catch(() => setEstado('sem-suporte'));
  }, []);

  async function ativar() {
    const chave = await fetch('/api/push/chave').then((r) => r.json());
    if (!chave.publica) return setEstado('sem-suporte');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return setEstado('negado');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaUint8(chave.publica) as BufferSource });
    await fetch('/api/push/assinar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
    setEstado('ativo');
  }

  const texto = {
    carregando: '…',
    'sem-suporte': 'Este navegador não recebe avisos. Você recebe os pedidos por e-mail.',
    'iphone-instalar': 'No iPhone, os avisos só funcionam com o app na Tela de Início.',
    ativo: 'Avisos ativos neste aparelho.',
    inativo: 'Receba os pedidos do escritório na hora, neste aparelho.',
    negado: 'Os avisos estão bloqueados nas configurações do navegador. Você recebe por e-mail.',
  }[estado];

  return (
    <section className="card p-4 flex flex-col gap-3">
      <div className="eyebrow">Avisos</div>
      <p className="text-[13.5px] text-fg-2">{texto}</p>
      {estado === 'inativo' && <button className="btn btn-lg" onClick={ativar}><Bell size={16} />Ativar avisos</button>}
      {estado === 'iphone-instalar' && <a className="btn btn-lg" href="/instalar">Como instalar</a>}
    </section>
  );
}
