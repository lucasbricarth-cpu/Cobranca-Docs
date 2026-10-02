export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { carregarComPermissao } from '@/lib/documentos/permissao';
import { rejeitarDocumento } from '@/lib/documentos/acoes';
import { aoRejeitar } from '@/lib/notificacoes/gatilhos';

/** "Rejeitar e pedir de novo": reabre o item com o motivo e avisa o cliente. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    await carregarComPermissao(s, params.id);
    const { motivo } = z.object({ motivo: z.string().min(3).max(500) }).parse(await req.json());
    const r = await rejeitarDocumento(params.id, motivo, s);
    if (r.itemId) await aoRejeitar(r.itemId);
    return ok();
  });
}
