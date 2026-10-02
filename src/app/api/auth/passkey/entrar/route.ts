export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, erro, tratar } from '@/lib/api';
import { criarSessao, gravarCookie, userAgentAtual } from '@/lib/auth/sessao';
import { opcoesDeEntrada, verificarEntrada } from '@/lib/auth/passkey';

export async function POST(req: Request) {
  return tratar(async () => {
    const { email } = z.object({ email: z.string().email().optional() }).parse(await req.json().catch(() => ({})));
    return Response.json(await opcoesDeEntrada(email));
  });
}
export async function PUT(req: Request) {
  return tratar(async () => {
    const { resposta, desafio } = z.object({ resposta: z.any(), desafio: z.string() }).parse(await req.json());
    const r = await verificarEntrada(resposta, desafio);
    if (!r) return erro('Passkey não reconhecida.', 401);
    const token = await criarSessao(r.tipo, r.id, userAgentAtual());
    gravarCookie(token, r.tipo);
    return ok({ tipo: r.tipo });
  });
}
