export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { sessaoAtual, NaoAutorizado } from '@/lib/auth/sessao';
import { carregarComPermissao } from '@/lib/documentos/permissao';
import { documentoPorId } from '@/lib/documentos/consultas';
import { armazenamento } from '@/lib/armazenamento';
import { q } from '@/lib/db';

/** URL temporária para ver (inline, sem baixar) ou baixar. Fica no registro de acesso. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await sessaoAtual();
    if (!s) throw new NaoAutorizado();
    const d = await carregarComPermissao(s, params.id);
    const modo = new URL(req.url).searchParams.get('modo') === 'baixar' ? 'baixar' : 'abrir';
    const info = await documentoPorId(d.id);
    const url = await armazenamento().urlLeitura(d.chave, { segundos: 120, inline: modo === 'abrir', nomeArquivo: info?.nome_download, mime: d.mime });
    await q(`INSERT INTO acessos_documento (documento_id, acao, usuario_id, login_id) VALUES ($1, $2, $3, $4)`,
      [d.id, modo, s.tipo === 'funcionario' ? s.id : null, s.tipo === 'cliente' ? s.id : null]);
    return ok({ url, mime: d.mime, nome: info?.nome_download });
  });
}
