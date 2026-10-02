import { Pool } from 'pg';
import { migrar } from '../src/lib/migrar.ts';
import { carregarEnv } from './env.ts';

carregarEnv();
const url = process.argv.includes('--test') ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida');
const pool = new Pool({ connectionString: url });
const feitas = await migrar(pool);
console.log(feitas.length ? `Aplicadas: ${feitas.join(', ')}` : 'Banco já estava em dia.');
await pool.end();
