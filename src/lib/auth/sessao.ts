import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { q, um } from '@/lib/db';

/**
 * Sessões por cookie httpOnly. O token nunca é guardado: só o hash.
 * O cliente fica logado por muito tempo no aparelho (365 dias); o
 * funcionário por 30 dias. O servidor valida a empresa em toda requisição
 * a partir dos vínculos do login (ver autorizarEmpresa).
 */
export const COOKIE = 'pd_sessao';
const DIAS_FUNCIONARIO = 30;
const DIAS_CLIENTE = 365;

export type Papel = 'admin' | 'funcionario';
export interface Funcionario { tipo: 'funcionario'; id: string; nome: string; email: string; papel: Papel }
export interface Cliente { tipo: 'cliente'; id: string; nome: string; email: string; empresas: { id: string; nome: string; cnpj: string }[] }
export type Sessao = Funcionario | Cliente;

export function hash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function novoToken(): string { return randomBytes(32).toString('base64url'); }

export async function criarSessao(tipo: 'funcionario' | 'cliente', id: string, userAgent?: string): Promise<string> {
  const token = novoToken();
  const dias = tipo === 'cliente' ? DIAS_CLIENTE : DIAS_FUNCIONARIO;
  await q(
    `INSERT INTO sessoes (token_hash, tipo, usuario_id, login_id, expira_em, user_agent)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval, $6)`,
    [hash(token), tipo, tipo === 'funcionario' ? id : null, tipo === 'cliente' ? id : null, String(dias), userAgent ?? null],
  );
  return token;
}

export function gravarCookie(token: string, tipo: 'funcionario' | 'cliente'): void {
  const dias = tipo === 'cliente' ? DIAS_CLIENTE : DIAS_FUNCIONARIO;
  cookies().set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    maxAge: dias * 86400,
  });
}

export async function encerrarSessao(): Promise<void> {
  const token = cookies().get(COOKIE)?.value;
  if (token) await q(`DELETE FROM sessoes WHERE token_hash = $1`, [hash(token)]);
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function sessaoPorToken(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  const s = await um<{ tipo: 'funcionario' | 'cliente'; usuario_id: string | null; login_id: string | null }>(
    `SELECT tipo, usuario_id, login_id FROM sessoes WHERE token_hash = $1 AND expira_em > now()`, [hash(token)],
  );
  if (!s) return null;
  if (s.tipo === 'funcionario' && s.usuario_id) {
    const u = await um<{ id: string; nome: string; email: string; papel: Papel }>(
      `SELECT id, nome, email, papel FROM usuarios WHERE id = $1 AND ativo`, [s.usuario_id]);
    return u ? { tipo: 'funcionario', id: u.id, nome: u.nome, email: u.email, papel: u.papel } : null;
  }
  if (s.tipo === 'cliente' && s.login_id) {
    const l = await um<{ id: string; nome: string; email: string }>(`SELECT id, nome, email FROM logins_cliente WHERE id = $1 AND ativo`, [s.login_id]);
    if (!l) return null;
    const empresas = (await q<{ id: string; nome: string; cnpj: string }>(
      `SELECT e.id, e.nome, e.cnpj FROM vinculos_login_empresa v JOIN empresas e ON e.id = v.empresa_id
       WHERE v.login_id = $1 AND e.ativo ORDER BY e.nome`, [l.id])).rows;
    return { tipo: 'cliente', id: l.id, nome: l.nome, email: l.email, empresas };
  }
  return null;
}

/** Sessão da requisição atual (Server Components e Route Handlers). */
export async function sessaoAtual(): Promise<Sessao | null> {
  return sessaoPorToken(cookies().get(COOKIE)?.value);
}
export async function exigirFuncionario(): Promise<Funcionario> {
  const s = await sessaoAtual();
  if (!s || s.tipo !== 'funcionario') throw new NaoAutorizado();
  return s;
}
export async function exigirAdmin(): Promise<Funcionario> {
  const s = await exigirFuncionario();
  if (s.papel !== 'admin') throw new NaoAutorizado('Só administradores.');
  return s;
}
export async function exigirCliente(): Promise<Cliente> {
  const s = await sessaoAtual();
  if (!s || s.tipo !== 'cliente') throw new NaoAutorizado();
  return s;
}

/**
 * Regra central de isolamento: a empresa pedida precisa estar nos vínculos
 * do login do cliente. Funcionário vê todas. Nunca se confia no id que vem
 * do aparelho sem passar por aqui.
 */
export function autorizarEmpresa(sessao: Sessao, empresaId: string): void {
  if (sessao.tipo === 'funcionario') return;
  if (!sessao.empresas.some((e) => e.id === empresaId)) throw new NaoAutorizado('Empresa fora dos vínculos deste login.');
}

export class NaoAutorizado extends Error {
  status = 401;
  constructor(msg = 'Não autorizado') { super(msg); }
}

export function userAgentAtual(): string | undefined {
  try { return headers().get('user-agent') ?? undefined; } catch { return undefined; }
}
