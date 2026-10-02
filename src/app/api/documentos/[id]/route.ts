export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { sessaoAtual, exigirFuncionario, NaoAutorizado } from '@/lib/auth/sessao';
import { carregarComPermissao } from '@/lib/documentos/permissao';
import { documentoPorId, auditoriaDoDocumento } from '@/lib/documentos/consultas';
import { classificarDocumento } from '@/lib/documentos/acoes';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await sessaoAtual();
    if (!s) throw new NaoAutorizado();
    await carregarComPermissao(s, params.id);
    const documento = await documentoPorId(params.id);
    const auditoria = s.tipo === 'funcionario' ? await auditoriaDoDocumento(params.id) : [];
    return ok({ documento, auditoria });
  });
}

const Classificar = z.object({
  empresaId: z.string().uuid(), tipoId: z.string().uuid(), subtipoId: z.string().uuid().nullable(),
  competencia: z.string().regex(/^\d{4}-\d{2}-01$/), conferir: z.boolean().default(false),
});
/** Classificar/mover (arrastar ou "Classificar"): só o escritório. Fica registrado. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    await carregarComPermissao(s, params.id);
    const d = Classificar.parse(await req.json());
    await classificarDocumento(params.id, d, s, d.conferir);
    return ok();
  });
}
