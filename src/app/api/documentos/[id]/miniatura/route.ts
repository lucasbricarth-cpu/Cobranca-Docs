export const dynamic = 'force-dynamic';
import { sessaoAtual } from '@/lib/auth/sessao';
import { carregarComPermissao } from '@/lib/documentos/permissao';
import { armazenamento } from '@/lib/armazenamento';

/** Miniatura: segue as permissões do original; sensível nunca tem. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await sessaoAtual();
  if (!s) return new Response(null, { status: 401 });
  try {
    const d = await carregarComPermissao(s, params.id);
    if (!d.miniatura_chave || d.sensivel) return new Response(null, { status: 404 });
    const img = await armazenamento().ler(d.miniatura_chave);
    return new Response(new Uint8Array(img), { headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=600' } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
