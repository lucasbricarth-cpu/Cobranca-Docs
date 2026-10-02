import { createHash, randomUUID } from 'node:crypto';
import { um } from '@/lib/db';
import { armazenamento } from '@/lib/armazenamento';
import { enfileirar, dispararFila } from '@/lib/fila';
import { limiteBytes } from '@/lib/seguranca/tipo-arquivo';
import { ErroApi } from '@/lib/api';

/**
 * Entrada única de arquivos (app, WhatsApp, escritório). O arquivo vai para
 * a quarentena e o documento nasce como 'processando': só aparece na pasta
 * depois do antivírus e das conferências (processar.ts).
 */
export interface NovoEnvio {
  dados: Buffer;
  nomeOriginal: string;
  origem: 'app' | 'whatsapp' | 'escritorio';
  empresaId: string | null;
  tipoId?: string | null;
  subtipoId?: string | null;
  competencia?: string | null;
  itemId?: string | null;
  comPedido?: boolean;
  sensivel?: boolean;
  loginId?: string | null;
  usuarioId?: string | null;
  whatsappNumero?: string | null;
}
export interface DocumentoRegistrado { id: string; duplicado: boolean; status: string; empresa_id: string | null }

export function hashDe(dados: Buffer): string { return createHash('sha256').update(dados).digest('hex'); }

export async function registrarEnvio(e: NovoEnvio): Promise<DocumentoRegistrado> {
  if (!e.dados.length) throw new ErroApi('Arquivo vazio.');
  if (e.dados.length > limiteBytes()) throw new ErroApi(`Arquivo maior que ${Math.round(limiteBytes() / 1024 / 1024)} MB.`, 413);
  const hash = hashDe(e.dados);

  // O mesmo arquivo (mesmo hash) na mesma empresa não vira dois documentos.
  const existente = await um<{ id: string; status: string; empresa_id: string | null }>(
    `SELECT id, status, empresa_id FROM documentos
     WHERE hash_sha256 = $1 AND excluido_em IS NULL AND status <> 'recusado'
       AND ((empresa_id = $2) OR (empresa_id IS NULL AND $2::uuid IS NULL))`, [hash, e.empresaId]);
  if (existente) return { ...existente, duplicado: true };

  const id = randomUUID();
  const chave = `quarentena/${id}`;
  await armazenamento().salvar(chave, e.dados, 'application/octet-stream');
  const ext = (e.nomeOriginal.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? 'bin').toLowerCase();
  try {
    await um(
      `INSERT INTO documentos (id, empresa_id, tipo_id, subtipo_id, competencia, item_id, com_pedido, sensivel, status, nome_original, mime, extensao,
                               tamanho, hash_sha256, chave, origem, enviado_por_login, enviado_por_usuario, whatsapp_numero)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processando', $9, 'application/octet-stream', $10, $11, $12, $13, $14, $15, $16, $17)`,
      [id, e.empresaId, e.tipoId ?? null, e.subtipoId ?? null, e.competencia ?? null, e.itemId ?? null, Boolean(e.comPedido ?? e.itemId),
        Boolean(e.sensivel), e.nomeOriginal.slice(0, 250), ext, e.dados.length, hash, chave, e.origem,
        e.loginId ?? null, e.usuarioId ?? null, e.whatsappNumero ?? null]);
  } catch (err) {
    // Corrida com outro envio do mesmo arquivo: o índice único segura; devolve o que já existe.
    await armazenamento().apagar(chave);
    const ja = await um<{ id: string; status: string; empresa_id: string | null }>(
      `SELECT id, status, empresa_id FROM documentos WHERE hash_sha256 = $1 AND excluido_em IS NULL AND status <> 'recusado' AND empresa_id IS NOT DISTINCT FROM $2`, [hash, e.empresaId]);
    if (ja) return { ...ja, duplicado: true };
    throw err;
  }
  await enfileirar('processar_documento', { id }, { chave: `proc:${id}` });
  dispararFila();
  return { id, duplicado: false, status: 'processando', empresa_id: e.empresaId };
}
