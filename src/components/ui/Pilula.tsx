import { AlertTriangle, Check, CheckCheck, Clock, Inbox, RotateCcw, History } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Pílula de status com cores FIXAS (não mudam com a paleta) e sempre
 * ícone + texto; a cor nunca é o único sinal (prompt §1).
 */
export type StatusItem = 'pendente' | 'atrasado' | 'recebido' | 'conferido' | 'refazer' | 'substituido';

const DEF: Record<StatusItem, { texto: string; classe: string; icone: ReactNode }> = {
  pendente:   { texto: 'Pendente',              classe: 'st-pendente',    icone: <Clock /> },
  atrasado:   { texto: 'Atrasado',              classe: 'st-atrasado',    icone: <AlertTriangle /> },
  recebido:   { texto: 'Recebido · a conferir', classe: 'st-recebido',    icone: <Inbox /> },
  conferido:  { texto: 'Conferido',             classe: 'st-conferido',   icone: <CheckCheck /> },
  refazer:    { texto: 'Refazer',               classe: 'st-refazer',     icone: <RotateCcw /> },
  substituido:{ texto: 'Substituído',           classe: 'st-substituido', icone: <History /> },
};

export function Pilula({ status, texto }: { status: StatusItem; texto?: string }) {
  const d = DEF[status];
  return (
    <span className={`pill ${d.classe}`} data-status={status}>
      {d.icone}
      {texto ?? d.texto}
    </span>
  );
}

export function PilulaSimples({ cor, children }: { cor: 'gold' | 'ok' | 'warn' | 'info' | 'danger' | 'neutra'; children: ReactNode }) {
  const cls = cor === 'neutra' ? 'pill' : `pill pill-${cor} pill-dot`;
  return <span className={cls}>{children}</span>;
}

export { Check };
