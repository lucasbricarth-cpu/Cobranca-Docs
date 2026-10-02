'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { interpretarBusca, chipsParaParametros, type ContextoBusca } from '@/lib/documentos/busca';

/** Digita "itaú setembro" → vira os chips [Itaú final 0567] [Set/2026] na URL; o resto é busca comum. */
export function BuscaArquivo({ contexto, base, textoAtual }: { contexto: ContextoBusca; base: string; textoAtual?: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(textoAtual ?? '');
  return (
    <form role="search" onSubmit={(e) => {
      e.preventDefault();
      const { chips, resto } = interpretarBusca(texto, contexto);
      const p = new URLSearchParams({ aba: 'arquivo', ...chipsParaParametros(chips) });
      if (resto) p.set('q', resto);
      setTexto(resto);
      router.push(`${base}?${p.toString()}`, { scroll: false });
    }}>
      <div className="input-group">
        <span className="input-icon"><Search size={15} /></span>
        <input className="input input-search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar: itaú setembro, fatura 3310, nota…" aria-label="Buscar arquivos" enterKeyHint="search" />
      </div>
    </form>
  );
}
