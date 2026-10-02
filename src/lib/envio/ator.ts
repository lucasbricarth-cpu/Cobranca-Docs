import { cookies } from 'next/headers';
import { q, um, todos } from '@/lib/db';
import { COOKIE, hash, novoToken, sessaoPorToken, NaoAutorizado, type Cliente } from '@/lib/auth/sessao';

/**
 * Quem está enviando. Duas formas:
 * - sessão do cliente (o app normal);
 * - link de envio (QR code ou WhatsApp): abre SÓ o envio daquele pedido,
 *   para aquele login e aquela empresa. Histórico e pasta continuam pedindo
 *   a entrada (passkey), porque o link pode ser encaminhado.
 */
export interface Ator {
  loginId: string;
  nome: string;
  empresas: { id: string; nome: string; cnpj: string }[];
  /** Quando veio por link: só este item e esta empresa. */
  escopo?: { linkId: string; empresaId: string; itemId: string | null };
}

export function aPartirDaSessao(s: Cliente): Ator {
  return { loginId: s.id, nome: s.nome, empresas: s.empresas };
}

export async function atorDaRequisicao(req: Request): Promise<Ator> {
  const token = req.headers.get('x-envio-token');
  if (token) {
    const a = await atorDoLink(token);
    if (!a) throw new NaoAutorizado('Link de envio expirado ou inválido.');
    return a;
  }
  const s = await sessaoPorToken(cookies().get(COOKIE)?.value);
  if (!s || s.tipo !== 'cliente') throw new NaoAutorizado();
  return aPartirDaSessao(s);
}

export async function atorDoLink(token: string): Promise<Ator | null> {
  const l = await um<{ id: string; login_id: string; empresa_id: string; item_id: string | null; nome: string; empresa_nome: string; cnpj: string }>(
    `SELECT le.id, le.login_id, le.empresa_id, le.item_id, l.nome, e.nome AS empresa_nome, e.cnpj
     FROM links_envio le JOIN logins_cliente l ON l.id = le.login_id AND l.ativo
     JOIN empresas e ON e.id = le.empresa_id
     JOIN vinculos_login_empresa v ON v.login_id = le.login_id AND v.empresa_id = le.empresa_id
     WHERE le.token_hash = $1 AND le.expira_em > now()`, [hash(token)]);
  if (!l) return null;
  return { loginId: l.login_id, nome: l.nome, empresas: [{ id: l.empresa_id, nome: l.empresa_nome, cnpj: l.cnpj }], escopo: { linkId: l.id, empresaId: l.empresa_id, itemId: l.item_id } };
}

/** Cria um link de envio para um item (QR: 30 min; WhatsApp/e-mail: 7 dias). */
export async function criarLinkEnvio(a: { loginId: string; empresaId: string; itemId: string | null; origem: 'qr' | 'whatsapp' | 'email' }): Promise<string> {
  const vinculo = await um(`SELECT 1 FROM vinculos_login_empresa WHERE login_id = $1 AND empresa_id = $2`, [a.loginId, a.empresaId]);
  if (!vinculo) throw new NaoAutorizado('Empresa fora dos vínculos deste login.');
  const token = novoToken();
  const validade = a.origem === 'qr' ? '30 minutes' : '7 days';
  await q(`INSERT INTO links_envio (token_hash, login_id, empresa_id, item_id, origem, expira_em) VALUES ($1, $2, $3, $4, $5, now() + $6::interval)`,
    [hash(token), a.loginId, a.empresaId, a.itemId, a.origem, validade]);
  return token;
}

export async function empresasDoAtor(a: Ator) { return a.empresas; }
export { todos };
