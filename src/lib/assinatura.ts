import { createHmac, timingSafeEqual } from 'node:crypto';

/** Tokens assinados com HMAC (APP_SECRET), com validade. Usados nas URLs de arquivo e nos links. */
function segredo(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new Error('APP_SECRET ausente ou curto demais');
  return s;
}
export function assinar(dados: Record<string, unknown>, segundos: number): string {
  const corpo = Buffer.from(JSON.stringify({ ...dados, exp: Math.floor(Date.now() / 1000) + segundos })).toString('base64url');
  const mac = createHmac('sha256', segredo()).update(corpo).digest('base64url');
  return `${corpo}.${mac}`;
}
export function verificar<T = Record<string, unknown>>(token: string): (T & { exp: number }) | null {
  const [corpo, mac] = token.split('.');
  if (!corpo || !mac) return null;
  const esperado = createHmac('sha256', segredo()).update(corpo).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (typeof d.exp !== 'number' || d.exp < Math.floor(Date.now() / 1000)) return null;
    return d;
  } catch { return null; }
}
