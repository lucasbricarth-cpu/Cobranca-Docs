export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { NaoAutorizado } from '@/lib/auth/sessao';
import { atorDaRequisicao } from '@/lib/envio/ator';
import { opcoesDeMes } from '@/lib/envio/mes';
import { uuidOuNada } from '@/lib/url';

/** Opções de mês para o popup (a mesma regra que o servidor aplica ao confirmar). */
export async function GET(req: Request) {
  return tratar(async () => {
    const ator = await atorDaRequisicao(req);
    const p = new URL(req.url).searchParams;
    const empresaId = uuidOuNada(p.get('empresa'));
    const tipoId = uuidOuNada(p.get('tipo'));
    if (!empresaId || !tipoId || !ator.empresas.some((e) => e.id === empresaId)) throw new NaoAutorizado();
    return ok({ opcoes: await opcoesDeMes({ itemId: uuidOuNada(p.get('item')) ?? null, empresaId, tipoId, subtipoId: uuidOuNada(p.get('sub')) ?? null }) });
  });
}
