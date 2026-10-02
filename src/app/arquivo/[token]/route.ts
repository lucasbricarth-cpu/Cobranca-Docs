export const dynamic = 'force-dynamic';
import { verificar } from '@/lib/assinatura';
import { armazenamento } from '@/lib/armazenamento';
import { limiteBytes } from '@/lib/seguranca/tipo-arquivo';
import { q, um } from '@/lib/db';

/**
 * URLs assinadas de curta duração do armazenamento local (em produção quem
 * serve é o S3). Leitura: op 'r'. Envio: op 'w' (PUT), um uso só.
 */
export async function GET(_: Request, { params }: { params: { token: string } }) {
  const t = verificar<{ op: string; c: string; d: string; m: string }>(params.token);
  if (!t || t.op !== 'r') return new Response('Link expirado ou inválido', { status: 403 });
  try {
    const dados = await armazenamento().ler(t.c);
    return new Response(new Uint8Array(dados), {
      headers: {
        'content-type': t.m, 'content-disposition': t.d, 'cache-control': 'private, no-store',
        // O arquivo nunca roda script: CSP fechada e sandbox (o pdf.js do app lê os bytes por fetch).
        'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        'cross-origin-resource-policy': 'same-origin',
      },
    });
  } catch {
    return new Response('Não encontrado', { status: 404 });
  }
}

export async function PUT(req: Request, { params }: { params: { token: string } }) {
  const t = verificar<{ op: string; c: string; m: string }>(params.token);
  if (!t || t.op !== 'w') return new Response('Link expirado ou inválido', { status: 403 });
  const up = await um<{ id: string }>(`SELECT id FROM uploads WHERE chave = $1 AND usado_em IS NULL AND expira_em > now()`, [t.c]);
  if (!up) return new Response('Envio já usado ou expirado', { status: 403 });
  const dados = Buffer.from(await req.arrayBuffer());
  if (dados.length > limiteBytes()) return new Response('Arquivo grande demais', { status: 413 });
  await armazenamento().salvar(t.c, dados, t.m);
  await q(`UPDATE uploads SET usado_em = now() WHERE id = $1`, [up.id]);
  return new Response(null, { status: 204 });
}
