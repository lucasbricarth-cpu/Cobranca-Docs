/**
 * OFX (extrato do banco), sem IA, de graça e exato: código do banco,
 * agência, conta e período. Aceita OFX 1.x (SGML) e 2.x (XML).
 */
export interface LeituraOfx { banco: string | null; agencia: string | null; conta: string | null; inicio: string | null; fim: string | null }

function campo(texto: string, nome: string): string | null {
  const m = texto.match(new RegExp(`<${nome}>\\s*([^<\\r\\n]+)`, 'i'));
  return m ? m[1].trim() : null;
}
const data = (v: string | null) => (v && /^\d{8}/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);

export function lerOfx(dados: Buffer): LeituraOfx | null {
  const t = dados.toString('latin1');
  if (!/<OFX>/i.test(t)) return null;
  const banco = campo(t, 'BANKID');
  return {
    banco: banco ? banco.replace(/\D/g, '').slice(-3).padStart(3, '0') : null,
    agencia: campo(t, 'BRANCHID'),
    conta: campo(t, 'ACCTID'),
    inicio: data(campo(t, 'DTSTART')),
    fim: data(campo(t, 'DTEND')),
  };
}
