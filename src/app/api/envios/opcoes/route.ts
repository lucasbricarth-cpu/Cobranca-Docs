export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { atorDaRequisicao } from '@/lib/envio/ator';
import { listarTipos } from '@/lib/documentos/tipos';
import { subtiposDaEmpresa } from '@/lib/documentos/subtipos';
import { NaoAutorizado } from '@/lib/auth/sessao';
import { uuidOuNada } from '@/lib/url';

/** Tipos e subtipos que o cliente pode escolher para uma empresa dos vínculos dele. Contas aparecem só pelo final. */
export async function GET(req: Request) {
  return tratar(async () => {
    const ator = await atorDaRequisicao(req);
    const empresaId = uuidOuNada(new URL(req.url).searchParams.get('empresa'));
    if (empresaId && !ator.empresas.some((e) => e.id === empresaId)) throw new NaoAutorizado();
    const tipos = (await listarTipos(true)).map((t) => ({ id: t.id, nome: t.nome, sensivel: t.sensivel, subtipo_origem: t.subtipo_origem, regra_mes: t.regra_mes }));
    const subtipos = empresaId ? (await subtiposDaEmpresa(empresaId)).filter((s) => s.ativo).map((s) => ({ id: s.id, tipo_id: s.tipo_id, rotulo: s.rotulo })) : [];
    return ok({ tipos, subtipos });
  });
}
