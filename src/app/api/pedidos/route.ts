export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { criarPedido } from '@/lib/pedidos';
import { aoCriarItens } from '@/lib/notificacoes/gatilhos';

const Pedido = z.object({
  empresaIds: z.array(z.string().uuid()).min(1).max(400),
  tipoId: z.string().uuid(),
  subtipos: z.union([z.literal('todos'), z.array(z.string().uuid())]),
  competencia: z.string().regex(/^\d{4}-\d{2}-01$/),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  mensagem: z.string().max(500).nullable().optional(),
});

/** Pedido avulso: uma empresa ou várias de uma vez. */
export async function POST(req: Request) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    const d = Pedido.parse(await req.json());
    const r = await criarPedido({ ...d, origem: 'avulso', criadoPor: s.id });
    await aoCriarItens(r.itensCriados);
    return ok({ ...r, itensCriados: r.itensCriados.length });
  });
}
