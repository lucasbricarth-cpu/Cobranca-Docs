export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin, exigirFuncionario } from '@/lib/auth/sessao';
import { um } from '@/lib/db';
import { DadosTipo, listarTipos } from '@/lib/documentos/tipos';

export async function GET() {
  return tratar(async () => {
    await exigirFuncionario();
    return ok({ tipos: await listarTipos() });
  });
}
export async function POST(req: Request) {
  return tratar(async () => {
    await exigirAdmin();
    const d = DadosTipo.parse(await req.json());
    const r = await um<{ id: string }>(
      `INSERT INTO tipos_documento (nome, subtipo_origem, regra_mes, sensivel, guarda_meses, icone, ativo, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT coalesce(max(ordem), 0) + 10 FROM tipos_documento)) RETURNING id`,
      [d.nome, d.subtipo_origem, d.regra_mes, d.sensivel, d.guarda_meses, d.icone, d.ativo]);
    return ok({ id: r!.id });
  });
}
