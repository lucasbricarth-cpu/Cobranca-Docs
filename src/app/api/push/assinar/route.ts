export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { sessaoAtual, NaoAutorizado, userAgentAtual } from '@/lib/auth/sessao';
import { q } from '@/lib/db';

const Assinatura = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function POST(req: Request) {
  return tratar(async () => {
    const s = await sessaoAtual();
    if (!s) throw new NaoAutorizado();
    const a = Assinatura.parse(await req.json());
    await q(
      `INSERT INTO push_assinaturas (usuario_id, login_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, login_id = EXCLUDED.login_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, falhou_em = NULL`,
      [s.tipo === 'funcionario' ? s.id : null, s.tipo === 'cliente' ? s.id : null, a.endpoint, a.keys.p256dh, a.keys.auth, userAgentAtual() ?? null]);
    return ok();
  });
}
