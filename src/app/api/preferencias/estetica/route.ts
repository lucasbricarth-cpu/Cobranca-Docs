export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { q, um } from '@/lib/db';
import { normalizarPrefs, PREFS_PADRAO } from '@/lib/backgroundPrefs';

/** Estética do funcionário: sempre a linha do usuário da sessão; o payload nunca diz de quem é. */
export async function GET() {
  return tratar(async () => {
    const s = await exigirFuncionario();
    const r = await um<{ estetica: unknown }>(`SELECT estetica FROM usuarios WHERE id = $1`, [s.id]);
    return ok({ prefs: r?.estetica ? normalizarPrefs(r.estetica) : PREFS_PADRAO });
  });
}
export async function PUT(req: Request) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    const { prefs } = z.object({ prefs: z.unknown() }).parse(await req.json());
    const p = normalizarPrefs(prefs);
    await q(`UPDATE usuarios SET estetica = $2 WHERE id = $1`, [s.id, JSON.stringify(p)]);
    return ok({ prefs: p });
  });
}
