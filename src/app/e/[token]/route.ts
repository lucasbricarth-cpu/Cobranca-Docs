export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { consumirLinkMagico } from '@/lib/auth/magico';
import { criarSessao, gravarCookie, userAgentAtual } from '@/lib/auth/sessao';

/** Link do e-mail: entra e vai direto ao destino. Vale uma vez e expira. */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const base = process.env.APP_URL || new URL(req.url).origin;
  const r = await consumirLinkMagico(params.token);
  if (!r) return NextResponse.redirect(`${base}/entrar?erro=link-invalido`);
  const token = await criarSessao(r.tipo, r.id, userAgentAtual());
  gravarCookie(token, r.tipo);
  const destino = r.destino && r.destino.startsWith('/') ? r.destino : r.tipo === 'cliente' ? '/cliente' : '/inicio';
  return NextResponse.redirect(`${base}${destino}`);
}
