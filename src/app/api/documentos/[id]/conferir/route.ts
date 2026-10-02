export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { carregarComPermissao } from '@/lib/documentos/permissao';
import { conferirDocumento } from '@/lib/documentos/acoes';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    await carregarComPermissao(s, params.id);
    await conferirDocumento(params.id, s);
    return ok();
  });
}
