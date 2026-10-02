export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { q } from '@/lib/db';
import { DadosModelo } from '@/lib/agenda-validacao';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirAdmin();
    const d = DadosModelo.partial().parse(await req.json());
    const campos = Object.entries(d);
    if (campos.length) await q(`UPDATE modelos_agenda SET ${campos.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [params.id, ...campos.map(([, v]) => v)]);
    return ok();
  });
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirAdmin();
    await q(`DELETE FROM modelos_agenda WHERE id = $1`, [params.id]);
    return ok();
  });
}
