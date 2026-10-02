export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { sessaoAtual, exigirFuncionario, NaoAutorizado } from '@/lib/auth/sessao';
import { exigirEmpresa } from '@/lib/acesso';
import { subtiposDaEmpresa, criarCartao, criarLivre } from '@/lib/documentos/subtipos';

/** Subtipos da empresa (o cliente lê os da própria empresa; contas aparecem mascaradas pelo final). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await sessaoAtual();
    if (!s) throw new NaoAutorizado();
    exigirEmpresa(s, params.id);
    const tipo = new URL(req.url).searchParams.get('tipo') ?? undefined;
    const lista = await subtiposDaEmpresa(params.id, tipo);
    return ok({ subtipos: lista.filter((x) => s.tipo === 'funcionario' || x.ativo).map((x) => ({ id: x.id, tipo_id: x.tipo_id, rotulo: x.rotulo, ativo: x.ativo })) });
  });
}
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirFuncionario();
    const d = z.object({ tipoId: z.string().uuid(), cartaoFinal: z.string().optional(), emissor: z.string().max(40).optional(), nome: z.string().max(80).optional() }).parse(await req.json());
    const id = d.cartaoFinal ? await criarCartao(params.id, d.tipoId, d.cartaoFinal, d.emissor) : await criarLivre(params.id, d.tipoId, d.nome ?? '');
    return ok({ id });
  });
}
