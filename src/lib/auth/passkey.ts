import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
  type RegistrationResponseJSON, type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { q, um, todos } from '@/lib/db';

/**
 * Passkeys (WebAuthn) para funcionário e cliente: depois do primeiro link
 * mágico, a pessoa cadastra a digital ou o rosto e passa a entrar por eles.
 */
const rpID = () => process.env.RP_ID || 'localhost';
const rpName = () => process.env.RP_NAME || 'Portal de Documentos';
const origem = () => process.env.APP_URL || `http://${rpID()}:3000`;

type Dono = { tipo: 'funcionario' | 'cliente'; id: string; nome: string; email: string };

export async function opcoesDeRegistro(dono: Dono) {
  const existentes = await todos<{ credential_id: string; transports: string[] | null }>(
    `SELECT credential_id, transports FROM passkeys WHERE ${dono.tipo === 'funcionario' ? 'usuario_id' : 'login_id'} = $1`, [dono.id]);
  const opcoes = await generateRegistrationOptions({
    rpName: rpName(), rpID: rpID(),
    userName: dono.email, userDisplayName: dono.nome,
    attestationType: 'none',
    excludeCredentials: existentes.map((e) => ({ id: e.credential_id, transports: e.transports as never })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await q(`DELETE FROM desafios_webauthn WHERE expira_em < now()`);
  await q(`INSERT INTO desafios_webauthn (desafio, tipo, usuario_id, login_id, expira_em) VALUES ($1, $2, $3, $4, now() + interval '5 minutes')`,
    [opcoes.challenge, dono.tipo, dono.tipo === 'funcionario' ? dono.id : null, dono.tipo === 'cliente' ? dono.id : null]);
  return opcoes;
}

export async function verificarRegistro(dono: Dono, resposta: RegistrationResponseJSON, apelido?: string): Promise<boolean> {
  const d = await um<{ id: string; desafio: string }>(
    `SELECT id, desafio FROM desafios_webauthn WHERE ${dono.tipo === 'funcionario' ? 'usuario_id' : 'login_id'} = $1 AND expira_em > now() ORDER BY expira_em DESC LIMIT 1`, [dono.id]);
  if (!d) return false;
  const v = await verifyRegistrationResponse({ response: resposta, expectedChallenge: d.desafio, expectedOrigin: origem(), expectedRPID: rpID() });
  await q(`DELETE FROM desafios_webauthn WHERE id = $1`, [d.id]);
  if (!v.verified || !v.registrationInfo) return false;
  const { credential } = v.registrationInfo;
  await q(
    `INSERT INTO passkeys (tipo, usuario_id, login_id, credential_id, public_key, counter, transports, apelido)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (credential_id) DO NOTHING`,
    [dono.tipo, dono.tipo === 'funcionario' ? dono.id : null, dono.tipo === 'cliente' ? dono.id : null,
      credential.id, Buffer.from(credential.publicKey), credential.counter, credential.transports ?? null, apelido ?? null]);
  return true;
}

export async function opcoesDeEntrada(email?: string) {
  let permitidas: { id: string; transports?: string[] }[] = [];
  if (email) {
    const linhas = await todos<{ credential_id: string; transports: string[] | null }>(
      `SELECT p.credential_id, p.transports FROM passkeys p
       LEFT JOIN usuarios u ON u.id = p.usuario_id LEFT JOIN logins_cliente l ON l.id = p.login_id
       WHERE lower(coalesce(u.email, l.email)) = lower($1)`, [email]);
    permitidas = linhas.map((l) => ({ id: l.credential_id, transports: l.transports ?? undefined }));
  }
  const opcoes = await generateAuthenticationOptions({ rpID: rpID(), userVerification: 'preferred', allowCredentials: permitidas as never });
  await q(`INSERT INTO desafios_webauthn (desafio, tipo, email, expira_em) VALUES ($1, 'entrada', $2, now() + interval '5 minutes')`, [opcoes.challenge, email ?? null]);
  return opcoes;
}

export async function verificarEntrada(resposta: AuthenticationResponseJSON, desafioEsperado: string): Promise<{ tipo: 'funcionario' | 'cliente'; id: string } | null> {
  const d = await um<{ id: string }>(`SELECT id FROM desafios_webauthn WHERE desafio = $1 AND tipo = 'entrada' AND expira_em > now()`, [desafioEsperado]);
  if (!d) return null;
  const p = await um<{ id: string; tipo: 'funcionario' | 'cliente'; usuario_id: string | null; login_id: string | null; public_key: Buffer; counter: string; transports: string[] | null }>(
    `SELECT id, tipo, usuario_id, login_id, public_key, counter, transports FROM passkeys WHERE credential_id = $1`, [resposta.id]);
  if (!p) return null;
  const v = await verifyAuthenticationResponse({
    response: resposta, expectedChallenge: desafioEsperado, expectedOrigin: origem(), expectedRPID: rpID(),
    credential: { id: resposta.id, publicKey: new Uint8Array(p.public_key), counter: Number(p.counter), transports: p.transports as never },
  });
  await q(`DELETE FROM desafios_webauthn WHERE id = $1`, [d.id]);
  if (!v.verified) return null;
  await q(`UPDATE passkeys SET counter = $2, usado_em = now() WHERE id = $1`, [p.id, v.authenticationInfo.newCounter]);
  const dono = p.tipo === 'funcionario' ? p.usuario_id : p.login_id;
  if (!dono) return null;
  // Login desativado não entra, mesmo com passkey.
  const ativo = p.tipo === 'funcionario'
    ? await um(`SELECT 1 FROM usuarios WHERE id = $1 AND ativo`, [dono])
    : await um(`SELECT 1 FROM logins_cliente WHERE id = $1 AND ativo`, [dono]);
  if (!ativo) return null;
  return { tipo: p.tipo, id: dono };
}
