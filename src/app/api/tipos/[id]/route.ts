export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { q } from '@/lib/db';
import { DadosTipo } from '@/lib/documentos/tipos';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirAdmin();
    const d = DadosTipo.partial().parse(await req.json());
    // Tipo sensível nunca é arquivado sozinho.
    if (d.arquivamento_automatico) {
      const { um } = await import('@/lib/db');
      const t = await um<{ sensivel: boolean }>(`SELECT sensivel FROM tipos_documento WHERE id = $1`, [params.id]);
      if (t?.sensivel || d.sensivel) d.arquivamento_automatico = false;
    }
    const campos = Object.entries(d);
    if (campos.length) {
      await q(`UPDATE tipos_documento SET ${campos.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [params.id, ...campos.map(([, v]) => v)]);
    }
    return ok();
  });
}
