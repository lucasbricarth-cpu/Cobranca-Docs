import { q, um, todos, transacao } from '@/lib/db';
import { criarLinkMagico } from '@/lib/auth/magico';
import { enviarEmail } from '@/lib/notificacoes/email';
import { texto } from '@/lib/notificacoes/textos';
import { ErroApi } from '@/lib/api';

/**
 * Logins dos clientes. Nascem SEMPRE por convite do escritório, ligados a
 * uma ou mais empresas (vinculos_login_empresa). O cliente nunca se cadastra
 * sozinho nem escolhe empresa fora dos vínculos dele.
 */
export async function convidarCliente(dados: { nome: string; email: string; empresaIds: string[] }, porUsuarioId: string) {
  const email = dados.email.trim().toLowerCase();
  if (!dados.empresaIds.length) throw new ErroApi('Escolha ao menos uma empresa.');
  const funcionario = await um(`SELECT 1 FROM usuarios WHERE lower(email) = $1`, [email]);
  if (funcionario) throw new ErroApi('Este e-mail é de um funcionário do escritório.');
  const loginId = await transacao(async (c) => {
    const existentes = await c.query<{ id: string; ativo: boolean }>(`SELECT id, ativo FROM logins_cliente WHERE lower(email) = $1`, [email]);
    let id = existentes.rows[0]?.id;
    if (!id) {
      id = (await c.query<{ id: string }>(`INSERT INTO logins_cliente (nome, email, convidado_por) VALUES ($1, $2, $3) RETURNING id`, [dados.nome.trim(), email, porUsuarioId])).rows[0].id;
    } else if (!existentes.rows[0].ativo) {
      throw new ErroApi('Este login está desativado. Reative-o antes de convidar de novo.');
    }
    const validas = await c.query<{ id: string }>(`SELECT id FROM empresas WHERE id = ANY($1)`, [dados.empresaIds]);
    if (validas.rowCount !== new Set(dados.empresaIds).size) throw new ErroApi('Empresa inválida no convite.');
    for (const e of dados.empresaIds) {
      await c.query(`INSERT INTO vinculos_login_empresa (login_id, empresa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, e]);
    }
    return id;
  });
  const empresas = await todos<{ nome: string }>(`SELECT nome FROM empresas WHERE id = ANY($1) ORDER BY nome`, [dados.empresaIds]);
  const token = await criarLinkMagico('cliente', loginId, '/cliente/conta?bem-vindo=1');
  const link = `${process.env.APP_URL ?? ''}/e/${token}`;
  const r = await enviarEmail({
    para: email,
    assunto: await texto('email.convite.assunto'),
    corpo: await texto('email.convite.corpo', { nome: dados.nome.split(' ')[0], empresa: empresas.map((e) => e.nome).join(', '), link }),
  });
  return { loginId, ...(r.linkDev ? { linkDev: link } : {}) };
}

export async function vincularEmpresa(loginId: string, empresaId: string) {
  await q(`INSERT INTO vinculos_login_empresa (login_id, empresa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [loginId, empresaId]);
}
export async function desvincularEmpresa(loginId: string, empresaId: string) {
  await q(`DELETE FROM vinculos_login_empresa WHERE login_id = $1 AND empresa_id = $2`, [loginId, empresaId]);
}

/**
 * Desativar: o login não entra mais, as sessões caem na hora e o vínculo do
 * número de WhatsApp é desligado no mesmo instante. Os arquivos que ele
 * mandou continuam (nada é apagado).
 */
export async function desativarLogin(loginId: string) {
  await transacao(async (c) => {
    await c.query(`UPDATE logins_cliente SET ativo = false, desativado_em = now() WHERE id = $1`, [loginId]);
    await c.query(`DELETE FROM sessoes WHERE login_id = $1`, [loginId]);
    await c.query(`UPDATE links_magicos SET usado_em = coalesce(usado_em, now()) WHERE login_id = $1`, [loginId]);
    const t = await c.query(`SELECT to_regclass('public.numeros_whatsapp') AS t`);
    if (t.rows[0].t) await c.query(`UPDATE numeros_whatsapp SET ativo = false, desligado_em = now() WHERE login_id = $1 AND ativo`, [loginId]);
  });
}
export async function reativarLogin(loginId: string) {
  await q(`UPDATE logins_cliente SET ativo = true, desativado_em = NULL WHERE id = $1`, [loginId]);
}

export async function loginsDaEmpresa(empresaId: string) {
  return todos<{ id: string; nome: string; email: string; ativo: boolean; criado_em: Date; passkeys: string; outras: string }>(
    `SELECT l.id, l.nome, l.email, l.ativo, l.criado_em,
            (SELECT count(*) FROM passkeys p WHERE p.login_id = l.id) AS passkeys,
            (SELECT count(*) FROM vinculos_login_empresa v2 WHERE v2.login_id = l.id AND v2.empresa_id <> $1) AS outras
     FROM vinculos_login_empresa v JOIN logins_cliente l ON l.id = v.login_id
     WHERE v.empresa_id = $1 ORDER BY l.ativo DESC, l.nome`, [empresaId]);
}

/** Funcionários (Admin cadastra). */
export async function criarFuncionario(d: { nome: string; email: string; papel: 'admin' | 'funcionario'; iResponsavel?: number | null }) {
  const email = d.email.trim().toLowerCase();
  const cliente = await um(`SELECT 1 FROM logins_cliente WHERE lower(email) = $1`, [email]);
  if (cliente) throw new ErroApi('Este e-mail é de um login de cliente.');
  const r = await um<{ id: string }>(
    `INSERT INTO usuarios (nome, email, papel, i_responsavel_dominio) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING id`, [d.nome.trim(), email, d.papel, d.iResponsavel ?? null]);
  if (!r) throw new ErroApi('Já existe um funcionário com este e-mail.');
  return r.id;
}
export async function alterarFuncionario(id: string, d: { papel?: 'admin' | 'funcionario'; ativo?: boolean; iResponsavel?: number | null }, porId: string) {
  if (id === porId && (d.ativo === false || d.papel === 'funcionario')) throw new ErroApi('Você não pode tirar o próprio acesso de Admin.');
  if (d.papel) await q(`UPDATE usuarios SET papel = $2 WHERE id = $1`, [id, d.papel]);
  if (d.iResponsavel !== undefined) await q(`UPDATE usuarios SET i_responsavel_dominio = $2 WHERE id = $1`, [id, d.iResponsavel]);
  if (d.ativo !== undefined) {
    await q(`UPDATE usuarios SET ativo = $2 WHERE id = $1`, [id, d.ativo]);
    if (!d.ativo) await q(`DELETE FROM sessoes WHERE usuario_id = $1`, [id]);
  }
}
