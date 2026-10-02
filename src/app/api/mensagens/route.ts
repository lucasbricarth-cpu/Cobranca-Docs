export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { q } from '@/lib/db';
import { TEXTOS_PADRAO, invalidarCacheDeTextos } from '@/lib/notificacoes/textos';

/** Ajustes › Mensagens: o escritório edita os textos sem mexer no código. Vazio = volta ao padrão. */
export async function PUT(req: Request) {
  return tratar(async () => {
    const s = await exigirAdmin();
    const d = z.object({ chave: z.string().max(80), texto: z.string().max(4000) }).parse(await req.json());
    if (!(d.chave in TEXTOS_PADRAO) && d.chave !== 'privacidade.texto') return ok({ ignorado: true });
    if (!d.texto.trim()) await q(`DELETE FROM mensagens WHERE chave = $1`, [d.chave]);
    else await q(`INSERT INTO mensagens (chave, texto, atualizado_por) VALUES ($1, $2, $3) ON CONFLICT (chave) DO UPDATE SET texto = EXCLUDED.texto, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`, [d.chave, d.texto, s.id]);
    invalidarCacheDeTextos();
    return ok();
  });
}
