export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, erro, tratar } from '@/lib/api';
import { sessaoAtual, NaoAutorizado } from '@/lib/auth/sessao';
import { opcoesDeRegistro, verificarRegistro } from '@/lib/auth/passkey';

export async function POST() {
  return tratar(async () => {
    const s = await sessaoAtual();
    if (!s) throw new NaoAutorizado();
    const o = await opcoesDeRegistro({ tipo: s.tipo, id: s.id, nome: s.nome, email: s.email });
    return Response.json(o);
  });
}
export async function PUT(req: Request) {
  return tratar(async () => {
    const s = await sessaoAtual();
    if (!s) throw new NaoAutorizado();
    const { resposta, apelido } = z.object({ resposta: z.any(), apelido: z.string().max(60).optional() }).parse(await req.json());
    const v = await verificarRegistro({ tipo: s.tipo, id: s.id, nome: s.nome, email: s.email }, resposta, apelido);
    return v ? ok() : erro('A passkey não pôde ser confirmada.');
  });
}
