export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { atorDaRequisicao } from '@/lib/envio/ator';
import { confirmarEnvio } from '@/lib/envio/servico';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const ator = await atorDaRequisicao(req);
    const d = z.object({
      empresaId: z.string().uuid(), tipoId: z.string().uuid(), subtipoId: z.string().uuid().nullable(),
      competencia: z.string().regex(/^\d{4}-\d{2}-01$/).nullable().optional(),
    }).parse(await req.json());
    return ok(await confirmarEnvio(ator, { uploadId: params.id, ...d }));
  });
}
