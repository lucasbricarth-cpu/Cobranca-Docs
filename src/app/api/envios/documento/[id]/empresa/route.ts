export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { atorDaRequisicao } from '@/lib/envio/ator';
import { mudarEmpresaDoEnvio } from '@/lib/envio/servico';

/** "Mudar empresa" (cliente), só enquanto o escritório não conferiu. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const ator = await atorDaRequisicao(req);
    const { empresaId } = z.object({ empresaId: z.string().uuid() }).parse(await req.json());
    await mudarEmpresaDoEnvio(ator, params.id, empresaId);
    return ok();
  });
}
