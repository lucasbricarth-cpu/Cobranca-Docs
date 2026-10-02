export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { NaoAutorizado } from '@/lib/auth/sessao';
import { atorDaRequisicao } from '@/lib/envio/ator';
import { um } from '@/lib/db';

/** Situação de um item (o computador consulta enquanto o celular fotografa pelo QR code). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const ator = await atorDaRequisicao(req);
    const it = await um<{ empresa_id: string; status: string; documento_id: string | null; recebido_em: Date | null }>(`SELECT empresa_id, status, documento_id, recebido_em FROM itens_pedido WHERE id = $1`, [params.id]);
    if (!it || !ator.empresas.some((e) => e.id === it.empresa_id)) throw new NaoAutorizado();
    return ok({ status: it.status, recebido_em: it.recebido_em });
  });
}
