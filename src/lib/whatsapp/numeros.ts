import { q, todos, um } from '@/lib/db';
import { ErroApi } from '@/lib/api';
import { paraE164 } from '@/lib/texto';

/**
 * Números de WhatsApp por login. Os telefones da Domínio
 * (GEEMPRE_CONTATO.TELEFONE_CONTATO e geempre.dddf_emp + fone_emp) só servem
 * de SUGESTÃO, já convertidos para +55 DDD número. O vínculo só vale depois
 * que um funcionário confirma.
 */
export async function sugestoesDeNumero(loginId: string) {
  return todos<{ numero: string; origem: string; empresa: string }>(
    `SELECT DISTINCT ON (x.numero) x.numero, x.origem, x.empresa FROM (
       SELECT c.telefone_e164 AS numero, 'Contato da Domínio' AS origem, e.nome AS empresa
       FROM contatos_empresa c JOIN empresas e ON e.id = c.empresa_id JOIN vinculos_login_empresa v ON v.empresa_id = e.id
       WHERE v.login_id = $1 AND c.telefone_e164 IS NOT NULL
       UNION ALL
       SELECT e.telefone_e164, 'Telefone da empresa (Domínio)', e.nome FROM empresas e JOIN vinculos_login_empresa v ON v.empresa_id = e.id
       WHERE v.login_id = $1 AND e.telefone_e164 IS NOT NULL
     ) x WHERE NOT EXISTS (SELECT 1 FROM numeros_whatsapp n WHERE n.numero = x.numero AND n.ativo)`, [loginId]);
}

export async function numerosDoLogin(loginId: string) {
  return todos<{ id: string; numero: string; confirmado_em: Date; quem: string; ativo: boolean }>(
    `SELECT n.id, n.numero, n.confirmado_em, u.nome AS quem, n.ativo FROM numeros_whatsapp n JOIN usuarios u ON u.id = n.confirmado_por
     WHERE n.login_id = $1 ORDER BY n.ativo DESC, n.confirmado_em DESC`, [loginId]);
}

export async function confirmarNumero(loginId: string, numeroBruto: string, usuarioId: string) {
  const numero = paraE164(null, numeroBruto);
  if (!numero) throw new ErroApi('Número inválido. Use DDD + número.');
  const login = await um<{ ativo: boolean }>(`SELECT ativo FROM logins_cliente WHERE id = $1`, [loginId]);
  if (!login?.ativo) throw new ErroApi('Login desativado.');
  const ja = await um<{ login_id: string }>(`SELECT login_id FROM numeros_whatsapp WHERE numero = $1 AND ativo`, [numero]);
  if (ja && ja.login_id !== loginId) throw new ErroApi('Este número já está ligado a outro login.');
  if (ja) return;
  await q(`INSERT INTO numeros_whatsapp (login_id, numero, confirmado_por) VALUES ($1, $2, $3)`, [loginId, numero, usuarioId]);
}
export async function desligarNumero(id: string) {
  await q(`UPDATE numeros_whatsapp SET ativo = false, desligado_em = now() WHERE id = $1`, [id]);
}

/** Login pelo número: só vínculo CONFIRMADO, ativo, de login ativo. */
export async function loginDoNumero(numero: string) {
  return um<{ login_id: string; nome: string }>(
    `SELECT n.login_id, l.nome FROM numeros_whatsapp n JOIN logins_cliente l ON l.id = n.login_id AND l.ativo WHERE n.numero = $1 AND n.ativo`, [numero]);
}
export async function empresasDoLogin(loginId: string) {
  return todos<{ id: string; nome: string; cnpj: string }>(
    `SELECT e.id, e.nome, e.cnpj FROM vinculos_login_empresa v JOIN empresas e ON e.id = v.empresa_id AND e.ativo WHERE v.login_id = $1 ORDER BY e.nome`, [loginId]);
}

export async function registrarAceite(loginId: string, canal: string, aceitoEm: string | null, usuarioId: string) {
  await q(`INSERT INTO aceites_whatsapp (login_id, aceito_em, canal, registrado_por) VALUES ($1, coalesce($2::timestamptz, now()), $3, $4)
           ON CONFLICT (login_id) DO UPDATE SET aceito_em = EXCLUDED.aceito_em, canal = EXCLUDED.canal, registrado_por = EXCLUDED.registrado_por, revogado_em = NULL`,
    [loginId, aceitoEm, canal, usuarioId]);
}
export async function revogarAceite(loginId: string) {
  await q(`UPDATE aceites_whatsapp SET revogado_em = now() WHERE login_id = $1`, [loginId]);
}
export async function temAceite(loginId: string): Promise<boolean> {
  return Boolean(await um(`SELECT 1 FROM aceites_whatsapp WHERE login_id = $1 AND revogado_em IS NULL`, [loginId]));
}
