'use client';
import { useCallback, useEffect, useState } from 'react';

/** Aviso curto (gd-toast). Use: const [toast, avisar] = useToast(); ... {toast} */
export function useToast(): [JSX.Element | null, (msg: string, tipo?: 'ok' | 'erro') => void] {
  const [m, setM] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);
  useEffect(() => { if (!m) return; const t = setTimeout(() => setM(null), 4000); return () => clearTimeout(t); }, [m]);
  const avisar = useCallback((msg: string, tipo: 'ok' | 'erro' = 'ok') => setM({ msg, tipo }), []);
  const el = m ? (
    <div className="toast gd-toast" role="status" aria-live="polite">
      <div className={`menu-solido ${m.tipo === 'erro' ? 'text-[var(--danger-text)]' : ''}`}>{m.msg}</div>
    </div>
  ) : null;
  return [el, avisar];
}
