import { Landmark, CreditCard, Receipt, ReceiptText, Banknote, Clock, HeartPulse, Users, ScrollText, FileText, HelpCircle, Lock, type LucideIcon } from 'lucide-react';

const MAPA: Record<string, LucideIcon> = {
  landmark: Landmark, 'credit-card': CreditCard, receipt: Receipt, 'receipt-text': ReceiptText, banknote: Banknote,
  clock: Clock, 'heart-pulse': HeartPulse, users: Users, 'scroll-text': ScrollText, 'file-text': FileText, 'help-circle': HelpCircle,
};
export const ICONES_TIPO = Object.keys(MAPA);
export function IconeTipo({ nome, sensivel = false, ...p }: { nome: string; sensivel?: boolean; size?: number; className?: string }) {
  const I = sensivel ? Lock : MAPA[nome] ?? FileText;
  return <I aria-hidden {...p} />;
}
