import { pool, fecharPool } from '@/lib/db';
import { migrar } from '@/lib/migrar';
import { semear } from '@/lib/semente';

/** Zera o banco de teste, aplica as migrations e a semente. */
export async function bancoLimpo() {
  const p = pool();
  await p.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrar(p);
  return semear(p);
}
export { fecharPool };
