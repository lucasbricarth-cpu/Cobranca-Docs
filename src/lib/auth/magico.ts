import { q, um } from '@/lib/db';
import { hash, novoToken } from './sessao';

/** Link mágico de uso único, válido por 30 minutos. */
export async function criarLinkMagico(tipo: 'funcionario' | 'cliente', id: string, destino?: string): Promise<string> {
  const token = novoToken();
  await q(
    `INSERT INTO links_magicos (token_hash, tipo, usuario_id, login_id, destino, expira_em)
     VALUES ($1, $2, $3, $4, $5, now() + interval '30 minutes')`,
    [hash(token), tipo, tipo === 'funcionario' ? id : null, tipo === 'cliente' ? id : null, destino ?? null],
  );
  return token;
}

export async function consumirLinkMagico(token: string): Promise<{ tipo: 'funcionario' | 'cliente'; id: string; destino: string | null } | null> {
  const r = await um<{ tipo: 'funcionario' | 'cliente'; usuario_id: string | null; login_id: string | null; destino: string | null }>(
    `UPDATE links_magicos SET usado_em = now()
     WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > now()
     RETURNING tipo, usuario_id, login_id, destino`, [hash(token)]);
  if (!r) return null;
  const id = r.tipo === 'funcionario' ? r.usuario_id : r.login_id;
  if (!id) return null;
  return { tipo: r.tipo, id, destino: r.destino };
}
