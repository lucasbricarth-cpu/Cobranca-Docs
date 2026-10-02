export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { atorDaRequisicao } from '@/lib/envio/ator';
import { analisarEnvio } from '@/lib/envio/servico';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const ator = await atorDaRequisicao(req);
    const d = z.object({ sensivel: z.boolean().default(false) }).parse(await req.json());
    return ok({ analise: await analisarEnvio(ator, params.id, d) });
  });
}
