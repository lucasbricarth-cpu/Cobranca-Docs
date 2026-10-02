import { rodarAgenda } from '@/lib/agenda';

/**
 * Job diário (no fuso de São Paulo, nunca pelo relógio do servidor).
 * As etapas seguintes acrescentam: lembretes (7), resumo do funcionário (7),
 * guarda e pasta geral (9).
 */
export type Passo = { nome: string; rodar: (agora: Date) => Promise<unknown> };
export const PASSOS_DIARIOS: Passo[] = [
  { nome: 'agenda', rodar: (agora) => rodarAgenda(agora) },
];

export async function rodarDiario(agora: Date = new Date()) {
  const resultado: Record<string, unknown> = {};
  for (const p of PASSOS_DIARIOS) {
    try { resultado[p.nome] = await p.rodar(agora); } catch (e) { resultado[p.nome] = { erro: (e as Error).message }; }
  }
  return resultado;
}
