export const dynamic = 'force-dynamic';
import { PassThrough, Readable } from 'node:stream';
import { tratar, ErroApi } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { exportarEmpresa, nomeDoZip } from '@/lib/guarda/exportar';
import { uuidOuNada } from '@/lib/url';

/** "Exportar tudo" (Admin): ZIP em fluxo, com a árvore de pastas do app e o índice. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const admin = await exigirAdmin();
    const empresaId = uuidOuNada(params.id);
    if (!empresaId) throw new ErroApi('Empresa não encontrada.', 404);
    const nome = await nomeDoZip(empresaId);
    const fluxo = new PassThrough();
    exportarEmpresa(empresaId, admin.id, fluxo).catch((e) => fluxo.destroy(e as Error));
    return new Response(Readable.toWeb(fluxo) as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="documentos.zip"; filename*=UTF-8''${encodeURIComponent(nome)}`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
