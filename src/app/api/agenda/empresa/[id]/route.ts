export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { q } from '@/lib/db';

/** Ajuste da agenda só para esta empresa (perfil, folha, desligar um modelo, mudar dias). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirFuncionario();
    const d = z.object({
      perfil: z.enum(['simples', 'presumido', 'mei']).optional(),
      temFolha: z.boolean().optional(),
      modelo: z.object({ id: z.string().uuid(), ativo: z.boolean(), dia_criacao: z.number().int().min(1).max(31).nullable(), dia_prazo: z.number().int().min(1).max(31).nullable() }).optional(),
    }).parse(await req.json());
    if (d.perfil) await q(`UPDATE empresas SET perfil = $2 WHERE id = $1`, [params.id, d.perfil]);
    if (d.temFolha !== undefined) await q(`UPDATE empresas SET tem_folha = $2 WHERE id = $1`, [params.id, d.temFolha]);
    if (d.modelo) {
      await q(`INSERT INTO agenda_empresa (empresa_id, modelo_id, ativo, dia_criacao, dia_prazo) VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (empresa_id, modelo_id) DO UPDATE SET ativo = EXCLUDED.ativo, dia_criacao = EXCLUDED.dia_criacao, dia_prazo = EXCLUDED.dia_prazo`,
        [params.id, d.modelo.id, d.modelo.ativo, d.modelo.dia_criacao, d.modelo.dia_prazo]);
    }
    return ok();
  });
}

/** Perfil, folha e os modelos que valem para esta empresa (com o ajuste dela). */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirFuncionario();
    const { todos, um } = await import('@/lib/db');
    const e = await um<{ perfil: string; tem_folha: boolean }>(`SELECT perfil, tem_folha FROM empresas WHERE id = $1`, [params.id]);
    const modelos = await todos(
      `SELECT m.id, m.perfil, t.nome AS tipo_nome, m.dia_criacao, m.dia_prazo, m.meses_competencia, m.ativo AS modelo_ativo,
              coalesce(a.ativo, true) AS ativo, a.dia_criacao AS dia_criacao_empresa, a.dia_prazo AS dia_prazo_empresa
       FROM modelos_agenda m JOIN tipos_documento t ON t.id = m.tipo_id
       LEFT JOIN agenda_empresa a ON a.modelo_id = m.id AND a.empresa_id = $1
       WHERE m.perfil = $2 OR (m.perfil = 'folha' AND $3)
       ORDER BY m.perfil, m.dia_criacao, t.ordem`, [params.id, e?.perfil, e?.tem_folha]);
    return ok({ empresa: e, modelos });
  });
}
