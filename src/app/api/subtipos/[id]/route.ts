export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { renomearSubtipo, ativarSubtipo } from '@/lib/documentos/subtipos';
import { q } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirFuncionario();
    const d = z.object({ nome: z.string().max(80).nullable().optional(), ativo: z.boolean().optional(), manterConta: z.boolean().optional() }).parse(await req.json());
    if (d.nome !== undefined) await renomearSubtipo(params.id, d.nome);
    if (d.ativo !== undefined) await ativarSubtipo(params.id, d.ativo);
    // "Continuar pedindo" diante da sugestão de conta encerrada: some a sugestão.
    if (d.manterConta) await q(`UPDATE contas_bancarias SET sugestao_encerrada_em = NULL WHERE id = (SELECT conta_bancaria_id FROM subtipos WHERE id = $1)`, [params.id]);
    return ok();
  });
}
