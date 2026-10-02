import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { nomeDoMes, somarMeses } from '@/lib/tempo';
import { comParametros } from '@/lib/url';

/** ‹ Setembro 2026 › — o mês ativo é um dos poucos lugares com a cor de destaque. */
export function SeletorMes({ competencia, params }: { competencia: string; params: Record<string, string | undefined> }) {
  return (
    <div className="mes-sel" role="group" aria-label="Mês de referência">
      <Link href={comParametros(params, { mes: somarMeses(competencia, -1), doc: null })} aria-label="Mês anterior" scroll={false}><ChevronLeft size={16} /></Link>
      <span className="mes-atual" aria-live="polite">{nomeDoMes(competencia)}</span>
      <Link href={comParametros(params, { mes: somarMeses(competencia, 1), doc: null })} aria-label="Próximo mês" scroll={false}><ChevronRight size={16} /></Link>
    </div>
  );
}
