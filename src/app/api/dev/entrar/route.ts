export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { um } from '@/lib/db';
import { criarSessao, gravarCookie } from '@/lib/auth/sessao';

/**
 * Atalho de desenvolvimento: entra como um e-mail da semente sem passar pelo
 * e-mail. Só responde com DEV_LOGIN=1 e acesso por localhost (as capturas usam).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Só com DEV_LOGIN=1 E acesso pelo próprio computador. Nunca ligue DEV_LOGIN no servidor real.
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (process.env.DEV_LOGIN !== '1' || !local) return new NextResponse('Not found', { status: 404 });
  const email = (url.searchParams.get('como') || '').toLowerCase();
  const func = await um<{ id: string }>(`SELECT id FROM usuarios WHERE lower(email) = $1`, [email]);
  const cli = func ? null : await um<{ id: string }>(`SELECT id FROM logins_cliente WHERE lower(email) = $1`, [email]);
  if (!func && !cli) return new NextResponse('sem usuário', { status: 404 });
  const tipo = func ? 'funcionario' : 'cliente';
  const token = await criarSessao(tipo, (func ?? cli)!.id);
  gravarCookie(token, tipo);
  const destino = url.searchParams.get('destino') || (tipo === 'cliente' ? '/cliente' : '/inicio');
  return NextResponse.redirect(`${url.origin}${destino}`);
}
