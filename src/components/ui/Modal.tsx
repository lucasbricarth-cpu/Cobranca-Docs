'use client';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Modal de vidro (no celular, folha inferior). Fecha com Esc e no fundo. */
export function Modal({ aberto, aoFechar, titulo, subtitulo, icone, children, rodape }: {
  aberto: boolean; aoFechar: () => void; titulo: string; subtitulo?: string; icone?: ReactNode; children: ReactNode; rodape?: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="modal gd-rise" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cab">
          {icone ? <span className="icone-id">{icone}</span> : null}
          <div className="flex-1 min-w-0">
            <div className="h2">{titulo}</div>
            {subtitulo ? <div className="text-[12.5px] text-fg-3 mt-0.5">{subtitulo}</div> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Fechar" onClick={aoFechar}><X size={16} /></button>
        </div>
        {children}
        {rodape ? <div className="modal-pe">{rodape}</div> : null}
      </div>
    </div>
  );
}
