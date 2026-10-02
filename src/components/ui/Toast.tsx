'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Aviso curto (gd-toast). Use: const [toast, avisar] = useToast(); ... {toast} */
export function useToast(): [React.ReactPortal | null, (msg: string, tipo?: 'ok' | 'erro') => void] {
  const [m, setM] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);
  useEffect(() => { if (!m) return; const t = setTimeout(() => setM(null), 4000); return () => clearTimeout(t); }, [m]);
  const avisar = useCallback((msg: string, tipo: 'ok' | 'erro' = 'ok') => setM({ msg, tipo }), []);
  // Portal no <body>, como o Modal: fica fixo na tela, acima da barra de abas.
  const el = m && typeof document !== 'undefined' ? createPortal(
    <div className="toast gd-toast" role="status" aria-live="polite">
      <div className={`menu-solido ${m.tipo === 'erro' ? 'text-[var(--danger-text)]' : ''}`}>{m.msg}</div>
    </div>, document.body) : null;
  return [el, avisar];
}
