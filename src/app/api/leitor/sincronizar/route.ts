export const dynamic = 'force-dynamic';
import { timingSafeEqual } from 'node:crypto';
import { ok, erro, tratar } from '@/lib/api';
import { sincronizarDominio } from '@/lib/dominio/sincronizar';

/** Recebe o lote do leitor local (de dentro para fora). Autorizado por token, comparado em tempo constante. */
export async function POST(req: Request) {
  return tratar(async () => {
    const esperado = process.env.LEITOR_DOMINIO_TOKEN ?? '';
    const veio = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(veio), b = Buffer.from(esperado);
    if (!esperado || a.length !== b.length || !timingSafeEqual(a, b)) return erro('Token do leitor inválido', 401);
    const resumo = await sincronizarDominio(await req.json());
    return ok({ resumo });
  });
}
