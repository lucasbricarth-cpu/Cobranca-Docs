import { q, um } from '@/lib/db';
import { hash, novoToken } from './sessao';

/**
 * Link mágico de uso único. Entrada: 30 minutos. Links dos e-mails de pedido
 * abrem direto o item, valem só para aquele login e expiram (3 dias).
 */
export async function criarLinkMagico(tipo: 'funcionario' | 'cliente', id: string, destino?: string, validade = '30 minutes'): Promise<string> {
  const token = novoToken();
  await q(
    `INSERT INTO links_magicos (token_hash, tipo, usuario_id, login_id, destino, expira_em)
     VALUES ($1, $2, $3, $4, $5, now() + $6::interval)`,
    [hash(token), tipo, tipo === 'funcionario' ? id : null, tipo === 'cliente' ? id : null, destino ?? null, validade],
  );
  return token;
}

/**
 * Consome o link. Se já foi usado (o cliente tocou duas vezes no mesmo e-mail)
 * e ainda vale, só segue para o destino quando a sessão atual é do MESMO login.
 */
export async function linkJaUsadoDoMesmoLogin(token: string, sessao: { tipo: string; id: string } | null): Promise<string | null> {
  if (!sessao) return null;
  const r = await um<{ tipo: string; usuario_id: string | null; login_id: string | null; destino: string | null }>(
    `SELECT tipo, usuario_id, login_id, destino FROM links_magicos WHERE token_hash = $1 AND usado_em IS NOT NULL AND expira_em > now()`, [hash(token)]);
  if (!r) return null;
  const dono = r.tipo === 'cliente' ? r.login_id : r.usuario_id;
  return r.tipo === sessao.tipo && dono === sessao.id ? r.destino ?? '/' : null;
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
