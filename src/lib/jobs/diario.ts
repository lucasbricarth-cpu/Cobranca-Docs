import { rodarAgenda } from '@/lib/agenda';
import { lembretesDoDia, resumoDiario } from '@/lib/notificacoes/avisos';
import { rodarFila } from '@/lib/fila';

/**
 * Job diário (no fuso de São Paulo, nunca pelo relógio do servidor).
 * As etapas seguintes acrescentam: lembretes (7), resumo do funcionário (7),
 * guarda e pasta geral (9).
 */
export type Passo = { nome: string; rodar: (agora: Date) => Promise<unknown> };
export const PASSOS_DIARIOS: Passo[] = [
  { nome: 'agenda', rodar: (agora) => rodarAgenda(agora) },
  // Os avisos dos pedidos que a agenda acabou de criar saem pela fila.
  { nome: 'fila', rodar: async () => { let n = 0; for (let i = 0; i < 20; i++) { const r = await rodarFila(50); n += r; if (r < 50) break; } return n; } },
  { nome: 'lembretes', rodar: (agora) => lembretesDoDia(agora) },
  { nome: 'resumo', rodar: (agora) => resumoDiario(agora) },
];

export async function rodarDiario(agora: Date = new Date()) {
  const resultado: Record<string, unknown> = {};
  for (const p of PASSOS_DIARIOS) {
    try { resultado[p.nome] = await p.rodar(agora); } catch (e) { resultado[p.nome] = { erro: (e as Error).message }; }
  }
  return resultado;
}
