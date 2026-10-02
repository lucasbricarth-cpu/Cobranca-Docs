/**
 * Dados de demonstração (desenvolvimento): um admin, um funcionário, empresas,
 * contas, um login de cliente com duas empresas, tipos e pedidos do mês.
 * Idempotente: pode rodar de novo.
 */
import { Pool } from 'pg';
import { carregarEnv } from './env.ts';
import { semear } from '../src/lib/semente.ts';

carregarEnv();
const url = process.argv.includes('--test') ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url });
const r = await semear(pool);
console.log(JSON.stringify(r, null, 2));
await pool.end();
