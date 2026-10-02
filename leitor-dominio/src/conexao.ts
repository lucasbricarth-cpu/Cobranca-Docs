import { conferirConsulta } from './trava.ts';

/** Conexão só de leitura: toda consulta passa pela trava antes de chegar ao banco. */
export interface Conexao {
  consultar<T = Record<string, unknown>>(sql: string): Promise<T[]>;
  fechar(): Promise<void>;
}

/** Normaliza as chaves para minúsculas (o SQL Anywhere devolve como foi escrito). */
function minusculas<T>(linhas: Record<string, unknown>[]): T[] {
  return linhas.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k.toLowerCase(), v])) as T);
}

export async function abrirConexao(env: NodeJS.ProcessEnv = process.env): Promise<Conexao> {
  const driver = env.DOMINIO_DRIVER ?? 'odbc';
  if (driver === 'odbc') {
    // Import pelo nome em variável: o pacote odbc só existe no servidor do escritório.
    const nome = 'odbc';
    const odbc = (await import(nome)).default;
    const c = await odbc.connect(env.DOMINIO_ODBC ?? '');
    return {
      async consultar<T>(sql: string) { conferirConsulta(sql); return minusculas<T>((await c.query(sql)) as unknown as Record<string, unknown>[]); },
      async fechar() { await c.close(); },
    };
  }
  if (driver === 'pg') {
    // Usado nos testes, com a Domínio simulada no Postgres e um usuário só de leitura.
    const { default: pg } = await import('pg');
    const c = new pg.Client({ connectionString: env.DOMINIO_PG });
    await c.connect();
    await c.query('SET default_transaction_read_only = on');
    return {
      async consultar<T>(sql: string) { conferirConsulta(sql); return minusculas<T>((await c.query(sql)).rows); },
      async fechar() { await c.end(); },
    };
  }
  throw new Error(`Driver desconhecido: ${driver}`);
}
