import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { NaoAutorizado } from '@/lib/auth/sessao';

/** Resposta JSON padrão e tratamento de erro das rotas de API. */
export function ok(dados: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, ...dados }, { status });
}
export function erro(mensagem: string, status = 400) {
  return NextResponse.json({ ok: false, erro: mensagem }, { status });
}
export class ErroApi extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}
export async function tratar(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    // Erros de controle do Next (renderização dinâmica, redirect, notFound) seguem adiante.
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === 'string' && (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_'))) throw e;
    if (e instanceof NaoAutorizado) return erro(e.message, e.status);
    if (e instanceof ErroApi) return erro(e.message, e.status);
    if (e instanceof ZodError) return erro(e.errors.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '), 400);
    console.error(e);
    return erro('Erro interno', 500);
  }
}
