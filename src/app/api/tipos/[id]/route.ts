export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { q } from '@/lib/db';
import { DadosTipo } from '@/lib/documentos/tipos';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirAdmin();
    const d = DadosTipo.partial().parse(await req.json());
    const campos = Object.entries(d);
    if (campos.length) {
      await q(`UPDATE tipos_documento SET ${campos.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [params.id, ...campos.map(([, v]) => v)]);
    }
    return ok();
  });
}
