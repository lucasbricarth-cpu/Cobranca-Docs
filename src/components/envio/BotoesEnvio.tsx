'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Paperclip, ScanLine, QrCode, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { FluxoEnvio } from './FluxoEnvio';
import { Modal } from '@/components/ui/Modal';
import { api } from './http';
import type { ItemDoEnvio } from './PopupConfirmar';

/** No computador, "Tirar foto" mostra um QR code: o cliente fotografa pelo celular e o arquivo aparece no mesmo pedido. */
function ehComputador(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: fine)').matches && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

export function BotoesEnvio({ item, empresas, token, grande = false, escanear = false }: {
  item: ItemDoEnvio | null; empresas: { id: string; nome: string; cnpj: string }[]; token?: string | null; grande?: boolean; escanear?: boolean;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [fluxo, setFluxo] = useState<{ fonte: 'camera' | 'arquivo'; arquivo?: File } | null>(null);
  const [qr, setQr] = useState<{ img: string; recebido: boolean } | null>(null);

  async function tirarFoto() {
    if (!ehComputador() || token) return setFluxo({ fonte: 'camera' });
    const empresaId = item?.empresaId ?? (empresas.length === 1 ? empresas[0].id : null);
    if (!empresaId) return setFluxo({ fonte: 'camera' });
    const r = await api<{ url: string }>('/api/envios/link', 'POST', { empresaId, itemId: item?.id ?? null });
    if (!r.ok) return setFluxo({ fonte: 'camera' });
    setQr({ img: await QRCode.toDataURL(r.url, { margin: 1, width: 240, color: { dark: '#1c1709', light: '#ffffff' } }), recebido: false });
  }

  // Enquanto o QR está aberto, consulta o item até o arquivo chegar pelo celular.
  useEffect(() => {
    if (!qr || qr.recebido || !item) return;
    const t = setInterval(async () => {
      const r = await api<{ status: string }>(`/api/envios/item/${item.id}`);
      if (r.ok && (r.status === 'recebido' || r.status === 'conferido')) { setQr((q) => (q ? { ...q, recebido: true } : q)); router.refresh(); }
    }, 3000);
    return () => clearInterval(t);
  }, [qr, item, router]);

  return (
    <>
      {escanear ? (
        <button className="btn btn-primary btn-escanear" onClick={tirarFoto}><ScanLine size={20} />Escanear documento</button>
      ) : (
        <div className={`grid grid-cols-2 gap-2 ${grande ? '' : 'mt-2'}`}>
          <button className={`btn ${grande ? 'btn-lg' : ''}`} onClick={tirarFoto}><Camera size={16} />Tirar foto</button>
          <button className={`btn ${grande ? 'btn-lg' : ''}`} onClick={() => entrada.current?.click()}><Paperclip size={16} />Anexar arquivo</button>
        </div>
      )}
      <input ref={entrada} type="file" className="sr-only" accept="application/pdf,image/*,.xml,.ofx,.xlsx,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFluxo({ fonte: 'arquivo', arquivo: f }); e.target.value = ''; }} />
      {fluxo && <FluxoEnvio fonte={fluxo.fonte} arquivoInicial={fluxo.arquivo} item={item} empresas={empresas} token={token} aoTerminar={() => router.refresh()} aoFechar={() => setFluxo(null)} />}
      <Modal aberto={Boolean(qr)} aoFechar={() => setQr(null)} titulo={qr?.recebido ? 'Recebido!' : 'Fotografe pelo celular'} icone={qr?.recebido ? <CheckCircle2 /> : <QrCode />}
        subtitulo={qr?.recebido ? 'O arquivo chegou pelo celular.' : 'Aponte a câmera do celular para o código. O link vale por 30 minutos e só envia para este pedido.'}
        rodape={<><button className="btn" onClick={() => { setQr(null); entrada.current?.click(); }}>Anexar arquivo daqui</button><button className="btn btn-primary" onClick={() => setQr(null)}>{qr?.recebido ? 'Pronto' : 'Fechar'}</button></>}>
        {qr && !qr.recebido && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr.img} alt="QR code para enviar pelo celular" className="mx-auto rounded-xl" width={240} height={240} />
        )}
        {qr?.recebido && <p className="text-[14px]">Pronto. O escritório vai conferir.</p>}
      </Modal>
    </>
  );
}
