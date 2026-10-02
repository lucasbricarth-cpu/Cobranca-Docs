import { todos, um, q, transacao } from '@/lib/db';
import { armazenamento } from '@/lib/armazenamento';
import { enfileirar, registrarTarefa } from '@/lib/fila';
import { dataSP, somarDias } from '@/lib/tempo';
import { ErroApi } from '@/lib/api';
import { nomeGerado } from '@/lib/documentos/nomes';

/**
 * Guarda dos documentos (Etapa 9).
 *
 * - Cada tipo tem um prazo de guarda em meses, contado do FIM do mês do
 *   documento (competência). Sem competência, conta do mês em que chegou.
 *   Sem tipo (Não reconhecidos de uma empresa): GUARDA_SEM_TIPO_MESES.
 * - Pasta geral (arquivos sem empresa): PASTA_GERAL_PRAZO_DIAS a partir do
 *   recebimento. [DECIDIR] o prazo; o padrão é provisório.
 * - O app NUNCA apaga sozinho. O job diário só lista o que venceu e avisa os
 *   Admins; a exclusão é aprovada por um Admin, documento por documento.
 * - Todas as datas no fuso de São Paulo, nunca pelo relógio do servidor.
 */
export type MotivoExclusao = 'guarda' | 'pasta_geral' | 'saida_cliente';

export function prazos() {
  return {
    pastaGeralDias: Number(process.env.PASTA_GERAL_PRAZO_DIAS ?? 90),
    pastaGeralAvisoDias: Number(process.env.PASTA_GERAL_AVISO_DIAS ?? 7),
    semTipoMeses: Number(process.env.GUARDA_SEM_TIPO_MESES ?? 60),
  };
}

/** Expressões SQL do vencimento e do motivo ($1 = dias da pasta geral, $2 = meses sem tipo). */
const VENCE_EM = `(CASE WHEN d.empresa_id IS NULL
    THEN (timezone('America/Sao_Paulo', d.recebido_em))::date + $1::int
    ELSE (coalesce(d.competencia, date_trunc('month', timezone('America/Sao_Paulo', d.recebido_em))::date)
          + make_interval(months => coalesce(t.guarda_meses, $2::int) + 1))::date END)`;
const MOTIVO = `(CASE WHEN d.empresa_id IS NULL THEN 'pasta_geral' ELSE 'guarda' END)`;
/** Só o que tem arquivo guardado: recusados já foram apagados na hora; "processando" ainda não terminou. */
const ELEGIVEL = `d.excluido_em IS NULL AND d.status NOT IN ('recusado', 'processando')`;

export interface DocVencimento {
  id: string; motivo: 'guarda' | 'pasta_geral'; vence_em: string; nome: string; nome_original: string;
  empresa_id: string | null; empresa_nome: string | null; tipo_nome: string | null; competencia: string | null;
  recebido_em: Date; whatsapp_numero: string | null; sensivel: boolean; guarda_meses: number | null;
}

async function listar(condicao: string, extra: unknown[], limite = 1000): Promise<DocVencimento[]> {
  const p = prazos();
  const linhas = await todos<Omit<DocVencimento, 'nome'>>(
    `SELECT d.id, ${MOTIVO} AS motivo, to_char(${VENCE_EM}, 'YYYY-MM-DD') AS vence_em, d.nome_original, d.empresa_id, e.nome AS empresa_nome,
            t.nome AS tipo_nome, to_char(d.competencia, 'YYYY-MM-DD') AS competencia, d.recebido_em, d.whatsapp_numero,
            (d.sensivel OR coalesce(t.sensivel, false)) AS sensivel, t.guarda_meses
     FROM documentos d LEFT JOIN tipos_documento t ON t.id = d.tipo_id LEFT JOIN empresas e ON e.id = d.empresa_id
     WHERE ${ELEGIVEL} AND ${condicao}
     ORDER BY ${VENCE_EM}, d.recebido_em LIMIT ${limite}`, [p.pastaGeralDias, p.semTipoMeses, ...extra]);
  return linhas.map((l) => ({ ...l, nome: nomeGerado({ tipo_nome: l.tipo_nome, competencia: l.competencia, nome_original: l.nome_original }) }));
}

/** O que venceu até `hoje` (data de São Paulo) e espera a aprovação de um Admin. */
export async function vencidos(hoje: string = dataSP(), motivo?: 'guarda' | 'pasta_geral'): Promise<DocVencimento[]> {
  return listar(`${VENCE_EM} <= $3::date ${motivo ? `AND ${MOTIVO} = $4` : ''}`, motivo ? [hoje, motivo] : [hoje]);
}

/** Pasta geral que vence nos próximos dias (aviso antecipado aos Admins). */
export async function aVencerNaPastaGeral(hoje: string = dataSP()): Promise<DocVencimento[]> {
  const ate = somarDias(hoje, prazos().pastaGeralAvisoDias);
  return listar(`d.empresa_id IS NULL AND ${VENCE_EM} > $3::date AND ${VENCE_EM} <= $4::date`, [hoje, ate]);
}

/**
 * Passo do job diário: avisa os Admins, uma vez por documento, do que vai
 * vencer na pasta geral e do que venceu a guarda. Não apaga nada.
 */
export async function rodarGuarda(agora: Date = new Date()) {
  const hoje = dataSP(agora);
  const pastaGeral = await aVencerNaPastaGeral(hoje);
  const venc = await vencidos(hoje);
  const ids = [...pastaGeral, ...venc].map((d) => d.id);
  const novos = ids.length
    ? (await todos<{ id: string; empresa_id: string | null }>(
        `UPDATE documentos SET guarda_avisado_em = now() WHERE id = ANY($1::uuid[]) AND guarda_avisado_em IS NULL RETURNING id, empresa_id`, [ids]))
    : [];
  const novosIds = new Set(novos.map((n) => n.id));
  const nPasta = pastaGeral.filter((d) => novosIds.has(d.id)).length;
  const nVencidos = venc.filter((d) => novosIds.has(d.id)).length;
  if (nPasta || nVencidos) {
    const { avisarAdminsGuarda } = await import('@/lib/notificacoes/avisos');
    await avisarAdminsGuarda({ aVencer: nPasta, vencidos: nVencidos, dias: prazos().pastaGeralAvisoDias, hoje });
  }
  return { vencidos: venc.length, aVencerPastaGeral: pastaGeral.length, avisados: novos.length };
}

/** Apaga o arquivo e a miniatura; se o armazenamento falhar, tenta de novo pela fila (o banco já marcou a exclusão). */
async function apagarArquivos(chaves: string[]) {
  for (const chave of chaves) {
    try { await armazenamento().apagar(chave); } catch { await enfileirar('apagar_arquivo', { chave }, { chave: `apagar:${chave}` }); }
  }
}
registrarTarefa('apagar_arquivo', async (d) => armazenamento().apagar(String(d.chave)));

/**
 * Exclusão aprovada por um Admin. Confere de novo, dentro da transação, que
 * cada documento ainda pode ser excluído por aquele motivo (nada sai por um
 * id trocado na requisição). Some o arquivo, a miniatura e os metadados
 * pessoais; fica a linha com quem aprovou e quando.
 */
export async function aprovarExclusao(o: { ids: string[]; motivo: MotivoExclusao; usuarioId: string; empresaId?: string; hoje?: string }): Promise<{ excluidos: number; exclusaoId: string | null }> {
  const ids = [...new Set(o.ids)];
  if (!ids.length) return { excluidos: 0, exclusaoId: null };
  const admin = await um<{ nome: string }>(`SELECT nome FROM usuarios WHERE id = $1 AND papel = 'admin' AND ativo`, [o.usuarioId]);
  if (!admin) throw new ErroApi('Só um Admin aprova exclusões.', 403);
  let permitidos: string[];
  if (o.motivo === 'saida_cliente') {
    if (!o.empresaId) throw new ErroApi('Empresa obrigatória.');
    permitidos = (await todos<{ id: string }>(`SELECT d.id FROM documentos d WHERE ${ELEGIVEL} AND d.empresa_id = $1 AND d.id = ANY($2::uuid[])`, [o.empresaId, ids])).map((r) => r.id);
  } else {
    const venc = await vencidos(o.hoje ?? dataSP(), o.motivo);
    const ok = new Set(venc.map((d) => d.id));
    permitidos = ids.filter((id) => ok.has(id));
  }
  if (permitidos.length !== ids.length) throw new ErroApi('Algum documento não está mais na lista de exclusão. Atualize a página.', 409);

  const { chaves, exclusaoId } = await transacao(async (c) => {
    const docs = (await c.query<{ id: string; chave: string; miniatura_chave: string | null; empresa_id: string | null }>(
      `SELECT id, chave, miniatura_chave, empresa_id FROM documentos WHERE id = ANY($1::uuid[]) AND excluido_em IS NULL FOR UPDATE`, [permitidos])).rows;
    const lista = docs.map((d) => d.id);
    await c.query(
      `UPDATE documentos SET excluido_em = now(), excluido_por = $2, nome_original = 'excluído', sugestao = NULL, cnpjs_lidos = NULL, whatsapp_numero = NULL
       WHERE id = ANY($1::uuid[])`, [lista, o.usuarioId]);
    await c.query(`UPDATE itens_pedido SET documento_id = NULL WHERE documento_id = ANY($1::uuid[])`, [lista]);
    await c.query(
      `INSERT INTO auditoria_documentos (documento_id, acao, para, usuario_id, quem) SELECT unnest($1::uuid[]), 'excluido', jsonb_build_object('motivo', $2::text), $3, $4`,
      [lista, o.motivo, o.usuarioId, admin.nome]);
    const ex = (await c.query<{ id: string }>(
      `INSERT INTO exclusoes (motivo, empresa_id, documentos, quantidade, aprovado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [o.motivo, o.empresaId ?? (new Set(docs.map((d) => d.empresa_id)).size === 1 ? docs[0]?.empresa_id ?? null : null), lista, lista.length, o.usuarioId])).rows[0];
    return { chaves: docs.flatMap((d) => [d.chave, d.miniatura_chave].filter((x): x is string => Boolean(x))), exclusaoId: ex.id };
  });
  await apagarArquivos(chaves);
  return { excluidos: permitidos.length, exclusaoId };
}

/** Saída de um cliente: só depois de uma exportação concluída que já inclui tudo o que chegou. */
export async function situacaoDaSaida(empresaId: string) {
  const r = await um<{ documentos: number; ultimo_recebido: Date | null; exportada_em: Date | null; exportada_por: string | null; arquivos: number | null; saida_em: Date | null }>(
    `SELECT (SELECT count(*)::int FROM documentos d WHERE ${ELEGIVEL} AND d.empresa_id = $1) AS documentos,
            (SELECT max(recebido_em) FROM documentos d WHERE d.empresa_id = $1 AND d.excluido_em IS NULL) AS ultimo_recebido,
            x.concluida_em AS exportada_em, u.nome AS exportada_por, x.arquivos, e.saida_em
     FROM empresas e
     LEFT JOIN LATERAL (SELECT * FROM exportacoes WHERE empresa_id = e.id AND concluida_em IS NOT NULL ORDER BY concluida_em DESC LIMIT 1) x ON true
     LEFT JOIN usuarios u ON u.id = x.usuario_id
     WHERE e.id = $1`, [empresaId]);
  if (!r) throw new ErroApi('Empresa não encontrada.', 404);
  const exportacaoAtual = Boolean(r.exportada_em && (!r.ultimo_recebido || r.exportada_em >= r.ultimo_recebido));
  return { ...r, exportacaoAtual };
}

export async function excluirEmpresa(o: { empresaId: string; usuarioId: string; confirmacao: string }) {
  const e = await um<{ cnpj: string }>(`SELECT cnpj FROM empresas WHERE id = $1`, [o.empresaId]);
  if (!e) throw new ErroApi('Empresa não encontrada.', 404);
  if (o.confirmacao.replace(/\D/g, '') !== e.cnpj.replace(/\D/g, '')) throw new ErroApi('Digite o CNPJ da empresa para confirmar.');
  const s = await situacaoDaSaida(o.empresaId);
  if (!s.exportacaoAtual) throw new ErroApi('Exporte tudo antes (e de novo, se chegou arquivo depois da última exportação).', 409);
  const ids = (await todos<{ id: string }>(`SELECT d.id FROM documentos d WHERE ${ELEGIVEL} AND d.empresa_id = $1`, [o.empresaId])).map((r) => r.id);
  const r = await aprovarExclusao({ ids, motivo: 'saida_cliente', usuarioId: o.usuarioId, empresaId: o.empresaId });
  await q(`UPDATE empresas SET saida_em = now() WHERE id = $1`, [o.empresaId]);
  // Pedidos abertos param (sem lembretes para quem saiu).
  await q(`UPDATE itens_pedido SET status = 'cancelado' WHERE empresa_id = $1 AND status IN ('pendente', 'refazer')`, [o.empresaId]);
  return r;
}

export async function historicoDeExclusoes(limite = 50) {
  return todos<{ id: string; motivo: MotivoExclusao; empresa: string | null; quantidade: number; aprovado_por: string; aprovado_em: Date }>(
    `SELECT x.id, x.motivo, e.nome AS empresa, x.quantidade, u.nome AS aprovado_por, x.aprovado_em
     FROM exclusoes x LEFT JOIN empresas e ON e.id = x.empresa_id JOIN usuarios u ON u.id = x.aprovado_por
     ORDER BY x.aprovado_em DESC LIMIT $1`, [limite]);
}
