import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pool } from 'pg';

/**
 * Migrations versionadas em SQL puro, na pasta /migrations, aplicadas em
 * ordem de nome (001_, 002_…). Cada arquivo roda numa transação e fica
 * registrado em `migracoes`; rodar de novo não reaplica.
 */
export async function migrar(pool: Pool, pasta = resolve(process.cwd(), 'migrations')): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const feitas = new Set((await pool.query<{ nome: string }>(`SELECT nome FROM migracoes`)).rows.map((r) => r.nome));
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
  const aplicadas: string[] = [];
  for (const f of arquivos) {
    if (feitas.has(f)) continue;
    const sql = readFileSync(resolve(pasta, f), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query(`INSERT INTO migracoes (nome) VALUES ($1)`, [f]);
      await c.query('COMMIT');
      aplicadas.push(f);
    } catch (e) {
      await c.query('ROLLBACK');
      throw new Error(`Migration ${f} falhou: ${(e as Error).message}`);
    } finally {
      c.release();
    }
  }
  return aplicadas;
}
