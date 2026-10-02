'use client';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

/** Lado do navegador das passkeys. */
export async function cadastrarPasskey(apelido?: string): Promise<boolean> {
  const o = await fetch('/api/auth/passkey/registrar', { method: 'POST' });
  if (!o.ok) throw new Error('Não foi possível iniciar o cadastro.');
  const opcoes = await o.json();
  const resposta = await startRegistration({ optionsJSON: opcoes });
  const v = await fetch('/api/auth/passkey/registrar', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resposta, apelido }) });
  const j = await v.json();
  return Boolean(j.ok);
}

export async function entrarComPasskey(email?: string): Promise<{ tipo: 'funcionario' | 'cliente'; destino?: string }> {
  const o = await fetch('/api/auth/passkey/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  if (!o.ok) throw new Error('Não foi possível iniciar a entrada.');
  const opcoes = await o.json();
  const resposta = await startAuthentication({ optionsJSON: opcoes });
  const v = await fetch('/api/auth/passkey/entrar', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resposta, desafio: opcoes.challenge }) });
  const j = await v.json();
  if (!j.ok) throw new Error(j.erro || 'Passkey não reconhecida.');
  return j;
}
