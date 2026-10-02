export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { atorDaRequisicao } from '@/lib/envio/ator';
import { iniciarEnvio } from '@/lib/envio/servico';

export async function POST(req: Request) {
  return tratar(async () => {
    const ator = await atorDaRequisicao(req);
    const d = z.object({ nomeOriginal: z.string().min(1).max(200), mime: z.string().max(100), itemId: z.string().uuid().nullable().optional() }).parse(await req.json());
    return ok(await iniciarEnvio(ator, d));
  });
}
