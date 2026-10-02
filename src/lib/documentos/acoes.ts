import type { PoolClient } from 'pg';
import { transacao, um } from '@/lib/db';
import { ErroApi } from '@/lib/api';
import type { Sessao } from '@/lib/auth/sessao';

/**
 * Ações sobre documentos, sempre com auditoria: toda troca de empresa, tipo,
 * subtipo ou mês fica registrada com quem fez, de quê para quê e quando.
 */
type Quem = { usuarioId?: string | null; loginId?: string | null; quem: string };
export function quemDaSessao(s: Sessao): Quem {
  return s.tipo === 'funcionario' ? { usuarioId: s.id, quem: s.nome } : { loginId: s.id, quem: s.nome };
}

export async function registrarAuditoria(c: PoolClient, documentoId: string, acao: string, de: unknown, para: unknown, quem: Quem) {
  await c.query(
    `INSERT INTO auditoria_documentos (documento_id, acao, de, para, usuario_id, login_id, quem) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [documentoId, acao, de === null ? null : JSON.stringify(de), para === null ? null : JSON.stringify(para), quem.usuarioId ?? null, quem.loginId ?? null, quem.quem]);
}

/**
 * Liga o documento ao item do pedido. Um arquivo novo para o mesmo item
 * vira o atual e o anterior fica "Substituído" (nunca é apagado).
 */
export async function vincularAoItem(c: PoolClient, documentoId: string, itemId: string, conferido = false) {
  const item = await c.query<{ documento_id: string | null }>(`SELECT documento_id FROM itens_pedido WHERE id = $1 FOR UPDATE`, [itemId]);
  const anterior = item.rows[0]?.documento_id;
  if (anterior && anterior !== documentoId) {
    await c.query(`UPDATE documentos SET status = 'substituido', substituido_por = $2 WHERE id = $1`, [anterior, documentoId]);
    await registrarAuditoria(c, anterior, 'substituido', null, { por: documentoId }, { quem: 'Sistema' });
  }
  await c.query(
    `UPDATE itens_pedido SET documento_id = $2, status = $3, recebido_em = now(), motivo_refazer = NULL,
            conferido_em = CASE WHEN $3 = 'conferido' THEN now() ELSE NULL END
     WHERE id = $1`, [itemId, documentoId, conferido ? 'conferido' : 'recebido']);
  await c.query(`UPDATE documentos SET item_id = $2, com_pedido = true WHERE id = $1`, [documentoId, itemId]);
}

export interface Classificacao { empresaId: string; tipoId: string; subtipoId: string | null; competencia: string }

/**
 * Classificar/mover (funcionário): arrastar para o tipo, subtipo e mês certos,
 * ou "Classificar". Se existir item de pedido com essa chave, o documento
 * entra nele (e o item fica Recebido · a conferir, ou Conferido).
 */
export async function classificarDocumento(documentoId: string, nova: Classificacao, s: Sessao, conferir = false) {
  if (s.tipo !== 'funcionario') throw new ErroApi('Só o escritório classifica.', 403);
  const quem = quemDaSessao(s);
  await transacao(async (c) => {
    const d = (await c.query<{ empresa_id: string | null; tipo_id: string | null; subtipo_id: string | null; competencia: string | null; status: string; item_id: string | null }>(
      `SELECT empresa_id, tipo_id, subtipo_id, to_char(competencia, 'YYYY-MM-DD') AS competencia, status, item_id FROM documentos WHERE id = $1 AND excluido_em IS NULL FOR UPDATE`, [documentoId])).rows[0];
    if (!d) throw new ErroApi('Documento não encontrado.', 404);
    if (['processando', 'recusado', 'substituido'].includes(d.status)) throw new ErroApi('Este documento não pode ser classificado agora.');
    await validarSubtipo(c, nova);
    const de = { empresa_id: d.empresa_id, tipo_id: d.tipo_id, subtipo_id: d.subtipo_id, competencia: d.competencia };
    const para = { empresa_id: nova.empresaId, tipo_id: nova.tipoId, subtipo_id: nova.subtipoId, competencia: nova.competencia };
    const mudou = JSON.stringify(de) !== JSON.stringify(para);
    const novoStatus = conferir ? 'conferido' : d.status === 'nao_reconhecido' ? 'a_conferir' : d.status === 'rejeitado' ? 'a_conferir' : d.status;
    await c.query(
      `UPDATE documentos SET empresa_id = $2, tipo_id = $3, subtipo_id = $4, competencia = $5, status = $6,
              conferido_em = CASE WHEN $6 = 'conferido' THEN now() ELSE conferido_em END,
              conferido_por = CASE WHEN $6 = 'conferido' THEN $7::uuid ELSE conferido_por END
       WHERE id = $1`, [documentoId, nova.empresaId, nova.tipoId, nova.subtipoId, nova.competencia, novoStatus, s.id]);
    if (mudou) await registrarAuditoria(c, documentoId, 'classificado', de, para, quem);
    if (conferir) await registrarAuditoria(c, documentoId, 'conferido', { status: d.status }, { status: 'conferido' }, quem);

    // Saiu do item antigo? O item volta a pendente (o arquivo não é apagado).
    if (d.item_id && mudou) {
      await c.query(`UPDATE itens_pedido SET documento_id = NULL, status = 'pendente', recebido_em = NULL, conferido_em = NULL WHERE id = $1 AND documento_id = $2`, [d.item_id, documentoId]);
      await c.query(`UPDATE documentos SET item_id = NULL WHERE id = $1`, [documentoId]);
    }
    // Entra no item que tem essa chave, se houver.
    const item = (await c.query<{ id: string }>(
      `SELECT id FROM itens_pedido WHERE empresa_id = $1 AND tipo_id = $2 AND subtipo_id IS NOT DISTINCT FROM $3 AND competencia = $4 AND status <> 'cancelado'`,
      [nova.empresaId, nova.tipoId, nova.subtipoId, nova.competencia])).rows[0];
    if (item) await vincularAoItem(c, documentoId, item.id, conferir);
  });
}

async function validarSubtipo(c: PoolClient, n: Classificacao) {
  const t = (await c.query<{ subtipo_origem: string | null }>(`SELECT subtipo_origem FROM tipos_documento WHERE id = $1`, [n.tipoId])).rows[0];
  if (!t) throw new ErroApi('Tipo inválido.');
  if (n.subtipoId) {
    const s = (await c.query(`SELECT 1 FROM subtipos WHERE id = $1 AND empresa_id = $2 AND tipo_id = $3`, [n.subtipoId, n.empresaId, n.tipoId])).rows[0];
    if (!s) throw new ErroApi('Subtipo não pertence a esta empresa e tipo.');
  } else if (t.subtipo_origem && t.subtipo_origem !== 'livre') {
    throw new ErroApi('Escolha o subtipo (a conta ou o cartão).');
  }
  if (!/^\d{4}-\d{2}-01$/.test(n.competencia)) throw new ErroApi('Mês inválido.');
}

/** Conferir: o funcionário confirma a sugestão como está. */
export async function conferirDocumento(documentoId: string, s: Sessao) {
  const d = await um<{ empresa_id: string | null; tipo_id: string | null; subtipo_id: string | null; competencia: string | null }>(
    `SELECT empresa_id, tipo_id, subtipo_id, to_char(competencia, 'YYYY-MM-DD') AS competencia FROM documentos WHERE id = $1`, [documentoId]);
  if (!d?.empresa_id || !d.tipo_id || !d.competencia) throw new ErroApi('Classifique o documento (empresa, tipo e mês) antes de conferir.');
  await classificarDocumento(documentoId, { empresaId: d.empresa_id, tipoId: d.tipo_id, subtipoId: d.subtipo_id, competencia: d.competencia }, s, true);
}

/**
 * "Rejeitar e pedir de novo": o documento fica Rejeitado (aparece como
 * "Refazer"), o item reabre com o motivo e o cliente é avisado (Etapa 7).
 */
export async function rejeitarDocumento(documentoId: string, motivo: string, s: Sessao): Promise<{ itemId: string | null }> {
  if (s.tipo !== 'funcionario') throw new ErroApi('Só o escritório rejeita.', 403);
  if (!motivo.trim()) throw new ErroApi('Escreva o motivo para o cliente.');
  return transacao(async (c) => {
    const d = (await c.query<{ status: string; item_id: string | null }>(`SELECT status, item_id FROM documentos WHERE id = $1 FOR UPDATE`, [documentoId])).rows[0];
    if (!d) throw new ErroApi('Documento não encontrado.', 404);
    await c.query(`UPDATE documentos SET status = 'rejeitado', motivo_rejeicao = $2 WHERE id = $1`, [documentoId, motivo.trim()]);
    await registrarAuditoria(c, documentoId, 'rejeitado', { status: d.status }, { status: 'rejeitado', motivo: motivo.trim() }, quemDaSessao(s));
    if (d.item_id) {
      await c.query(`UPDATE itens_pedido SET status = 'refazer', motivo_refazer = $2, conferido_em = NULL WHERE id = $1`, [d.item_id, motivo.trim()]);
    }
    return { itemId: d.item_id };
  });
}
