export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, erro, tratar } from '@/lib/api';
import { um } from '@/lib/db';
import { criarLinkMagico } from '@/lib/auth/magico';
import { enviarEmail } from '@/lib/notificacoes/email';
import { texto } from '@/lib/notificacoes/textos';

const Corpo = z.object({ email: z.string().email().max(200), destino: z.string().max(300).optional() });

/**
 * Pede um link mágico. A resposta é a mesma exista ou não o e-mail (não
 * revela cadastros). Em desenvolvimento (EMAIL=log) devolve o link.
 */
export async function POST(req: Request) {
  return tratar(async () => {
    const { email, destino } = Corpo.parse(await req.json());
    const e = email.trim().toLowerCase();
    const func = await um<{ id: string }>(`SELECT id FROM usuarios WHERE lower(email) = $1 AND ativo`, [e]);
    const cli = func ? null : await um<{ id: string }>(`SELECT id FROM logins_cliente WHERE lower(email) = $1 AND ativo`, [e]);
    const dest = destino && destino.startsWith('/') ? destino : undefined;
    if (!func && !cli) return ok({ enviado: true });
    const tipo = func ? 'funcionario' : 'cliente';
    const token = await criarLinkMagico(tipo, (func ?? cli)!.id, dest);
    const url = `${process.env.APP_URL ?? ''}/e/${token}`;
    const r = await enviarEmail({
      para: e,
      assunto: await texto("email.link.assunto"),
      corpo: await texto("email.link.corpo", { link: url }),
    });
    return ok({ enviado: true, ...(r.linkDev ? { linkDev: url } : {}) });
  });
}
export async function GET() { return erro('Use POST', 405); }
