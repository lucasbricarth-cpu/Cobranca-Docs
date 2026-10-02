import { timingSafeEqual } from 'node:crypto';

/** Rotas de job (cron externo): Authorization: Bearer JOB_SECRET, comparado em tempo constante. */
export function jobAutorizado(req: Request): boolean {
  const esperado = process.env.JOB_SECRET ?? '';
  const veio = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(veio), b = Buffer.from(esperado);
  return Boolean(esperado) && a.length === b.length && timingSafeEqual(a, b);
}
