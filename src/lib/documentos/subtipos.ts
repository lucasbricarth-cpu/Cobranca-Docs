import type { PoolClient } from 'pg';

/** Chamado ao fim de cada sincronização (a Etapa 3 cria aqui os subtipos de Extrato, um por conta). */
export async function aoSincronizarContas(_c: PoolClient): Promise<void> {
  // preenchido na Etapa 3
}
