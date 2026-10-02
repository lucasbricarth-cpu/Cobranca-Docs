export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar, ErroApi } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { excluirEmpresa, situacaoDaSaida } from '@/lib/guarda';
import { uuidOuNada } from '@/lib/url';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirAdmin();
    const empresaId = uuidOuNada(params.id);
    if (!empresaId) throw new ErroApi('Empresa não encontrada.', 404);
    return ok({ situacao: await situacaoDaSaida(empresaId) });
  });
}

/** Saída do cliente: exclui todos os documentos da empresa. Só um Admin, com o CNPJ digitado e depois de exportar tudo. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const admin = await exigirAdmin();
    const empresaId = uuidOuNada(params.id);
    if (!empresaId) throw new ErroApi('Empresa não encontrada.', 404);
    const d = z.object({ confirmacao: z.string().min(1) }).parse(await req.json());
    return ok(await excluirEmpresa({ empresaId, usuarioId: admin.id, confirmacao: d.confirmacao }));
  });
}
