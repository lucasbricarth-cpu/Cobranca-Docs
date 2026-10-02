'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Mede a própria altura e publica numa variável CSS do pai (para cabeçalhos fixos empilhados). */
export function MedirAltura({ variavel, className, children }: { variavel: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const pai = el?.parentElement;
    if (!el || !pai) return;
    const ro = new ResizeObserver(() => pai.style.setProperty(variavel, `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [variavel]);
  return <div ref={ref} className={className}>{children}</div>;
}
