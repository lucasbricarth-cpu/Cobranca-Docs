import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

/**
 * Pool único do Postgres. A URL vem do ambiente (DATABASE_URL; nos testes,
 * DATABASE_URL_TEST). O fuso do app é America/Sao_Paulo e as datas de
 * competência são DATE (primeiro dia do mês), então o relógio do servidor
 * nunca entra na conta: ver src/lib/tempo.ts.
 */
declare global {
  // eslint-disable-next-line no-var
  var __pdPool: Pool | undefined;
}

function urlDoBanco(): string {
  const url = process.env.NODE_ENV === 'test' || process.env.VITEST ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida');
  return url;
}

export function pool(): Pool {
  if (!global.__pdPool) {
    // O fuso da sessão do banco é o de São Paulo (now()::date e afins), nunca o do servidor.
    global.__pdPool = new Pool({ connectionString: urlDoBanco(), max: 10, options: '-c TimeZone=America/Sao_Paulo' });
  }
  return global.__pdPool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(texto: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return pool().query<T>(texto, params);
}
export async function um<T extends QueryResultRow = QueryResultRow>(texto: string, params: unknown[] = []): Promise<T | null> {
  const r = await pool().query<T>(texto, params);
  return r.rows[0] ?? null;
}
export async function todos<T extends QueryResultRow = QueryResultRow>(texto: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(texto, params)).rows;
}

/** Transação: a função recebe o client e tudo é confirmado ou desfeito. */
export async function transacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export async function fecharPool(): Promise<void> {
  if (global.__pdPool) { await global.__pdPool.end(); global.__pdPool = undefined; }
}
