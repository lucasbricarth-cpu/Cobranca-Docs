export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirCliente } from '@/lib/auth/sessao';
import { criarLinkEnvio } from '@/lib/envio/ator';

/** QR code do computador: um link de envio de 30 minutos, só para aquele pedido. */
export async function POST(req: Request) {
  return tratar(async () => {
    const s = await exigirCliente();
    const d = z.object({ empresaId: z.string().uuid(), itemId: z.string().uuid().nullable() }).parse(await req.json());
    const token = await criarLinkEnvio({ loginId: s.id, empresaId: d.empresaId, itemId: d.itemId, origem: 'qr' });
    return ok({ url: `${process.env.APP_URL ?? new URL(req.url).origin}/enviar/${token}` });
  });
}
