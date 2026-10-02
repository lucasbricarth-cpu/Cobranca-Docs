import { randomUUID } from 'node:crypto';
import { q, um, transacao } from '@/lib/db';
import { ErroApi } from '@/lib/api';
import { NaoAutorizado } from '@/lib/auth/sessao';
import { armazenamento } from '@/lib/armazenamento';
import { detectarTipo, pdfTemJavascript, limiteBytes } from '@/lib/seguranca/tipo-arquivo';
import { cnpjsDoConteudo } from '@/lib/classificacao/leitura';
import { sugerirParaEnvio } from '@/lib/classificacao';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { registrarAuditoria, vincularAoItem } from '@/lib/documentos/acoes';
import { resolverMes } from './mes';
import type { Ator } from './ator';

/**
 * Envio do cliente em três passos:
 * 1. iniciar: devolve uma URL assinada de curta duração para o arquivo;
 * 2. analisar: tipo real, CNPJs lidos e a sugestão de tipo/subtipo (sem IA se sensível);
 * 3. confirmar: empresa (sempre dos vínculos), tipo, subtipo e mês, validados no servidor.
 */
function exigirEmpresaDoAtor(ator: Ator, empresaId: string) {
  if (!ator.empresas.some((e) => e.id === empresaId)) throw new NaoAutorizado('Empresa fora dos vínculos deste login.');
  if (ator.escopo && ator.escopo.empresaId !== empresaId) throw new NaoAutorizado('Este link só envia para a empresa do pedido.');
}

async function itemDoAtor(ator: Ator, itemId: string) {
  const it = await um<{ id: string; empresa_id: string; tipo_id: string; subtipo_id: string | null; status: string; sensivel: boolean }>(
    `SELECT i.id, i.empresa_id, i.tipo_id, i.subtipo_id, i.status, t.sensivel FROM itens_pedido i JOIN tipos_documento t ON t.id = i.tipo_id WHERE i.id = $1`, [itemId]);
  if (!it) throw new ErroApi('Pedido não encontrado.', 404);
  exigirEmpresaDoAtor(ator, it.empresa_id);
  if (ator.escopo?.itemId && ator.escopo.itemId !== itemId) throw new NaoAutorizado('Este link só envia para o pedido dele.');
  if (it.status === 'cancelado' || it.status === 'conferido') throw new ErroApi('Este pedido não espera mais arquivo.');
  return it;
}

export async function iniciarEnvio(ator: Ator, a: { nomeOriginal: string; mime: string; itemId?: string | null }) {
  if (a.itemId) await itemDoAtor(ator, a.itemId);
  const id = randomUUID();
  const chave = `entrada/${id}`;
  await q(`INSERT INTO uploads (id, chave, login_id, tamanho_max, expira_em, nome_original, item_id, link_envio)
           VALUES ($1, $2, $3, $4, now() + interval '10 minutes', $5, $6, $7)`,
    [id, chave, ator.loginId, limiteBytes(), a.nomeOriginal.slice(0, 200), a.itemId ?? null, ator.escopo?.linkId ?? null]);
  const destino = await armazenamento().urlEnvio(chave, { mime: a.mime || 'application/octet-stream', segundos: 600 });
  return { uploadId: id, ...destino };
}

async function uploadDoAtor(ator: Ator, uploadId: string) {
  const u = await um<{ id: string; chave: string; nome_original: string; item_id: string | null; sensivel: boolean; analise: Record<string, unknown> | null; confirmado_em: Date | null }>(
    `SELECT id, chave, nome_original, item_id, sensivel, analise, confirmado_em FROM uploads WHERE id = $1 AND login_id = $2 AND expira_em > now() - interval '1 day'`, [uploadId, ator.loginId]);
  if (!u) throw new ErroApi('Envio não encontrado. Tente de novo.', 404);
  if (u.confirmado_em) throw new ErroApi('Este envio já foi confirmado.');
  return u;
}

export interface Analise {
  tipoReal: string;
  cnpjs: string[];
  empresaSugerida: string | null;
  sugestao: { tipoId: string | null; subtipoId: string | null; rotulo: string; competenciaLida?: string | null; novaConta?: string | null } | null;
  avisos: string[];
}

/**
 * Analisa o arquivo enviado. Documento sensível (tipo sensível do pedido, ou o
 * cliente respondeu "sim" a "É documento de saúde de funcionário?") NÃO passa
 * pela IA: só o tipo real e os CNPJs do texto.
 */
export async function analisarEnvio(ator: Ator, uploadId: string, o: { sensivel: boolean }): Promise<Analise> {
  const u = await uploadDoAtor(ator, uploadId);
  const dados = await armazenamento().ler(u.chave).catch(() => { throw new ErroApi('O arquivo não chegou. Tente de novo.'); });
  if (dados.length > limiteBytes()) throw new ErroApi(`Arquivo maior que ${Math.round(limiteBytes() / 1048576)} MB.`, 413);
  const tipo = detectarTipo(dados);
  if (!tipo) throw new ErroApi('Este tipo de arquivo não é aceito. Envie PDF, foto (JPG, PNG, HEIC), XML, OFX ou planilha.');
  if (tipo.familia === 'pdf' && (await pdfTemJavascript(dados))) throw new ErroApi('Este PDF tem conteúdo ativo e não pode ser recebido. Exporte de novo como PDF simples.');

  const item = u.item_id ? await itemDoAtor(ator, u.item_id) : null;
  const sensivel = o.sensivel || Boolean(item?.sensivel);
  const cnpjs = await cnpjsDoConteudo(dados, tipo);
  const avisos: string[] = [];

  // Empresa: só se o CNPJ lido bater EXATAMENTE com uma empresa do login.
  const doLogin = ator.empresas.filter((e) => cnpjs.includes(e.cnpj));
  const empresaSugerida = item ? item.empresa_id : doLogin.length === 1 ? doLogin[0].id : null;

  let sugestao: Analise['sugestao'] = null;
  let cnpjsLidos = cnpjs;
  if (!sensivel) {
    const comp = item ? (await um<{ c: string }>(`SELECT to_char(competencia, 'YYYY-MM-DD') AS c FROM itens_pedido WHERE id = $1`, [item.id]))?.c : undefined;
    const r = await sugerirParaEnvio({ dados, tipoReal: tipo, empresaId: empresaSugerida ?? (ator.empresas.length === 1 ? ator.empresas[0].id : null), empresasDoLogin: ator.empresas.map((e) => e.id), cnpjs, item: item ? { tipoId: item.tipo_id, subtipoId: item.subtipo_id, competencia: comp } : null });
    sugestao = r.sugestao;
    cnpjsLidos = r.cnpjs;
    if (r.aviso) avisos.push(r.aviso);
  }
  // Empresa pelo CNPJ também vale para o que a IA leu numa foto.
  const sugeridaFinal = empresaSugerida ?? (() => { const m = ator.empresas.filter((e) => cnpjsLidos.includes(e.cnpj)); return m.length === 1 ? m[0].id : null; })();
  await q(`UPDATE uploads SET sensivel = $2, analise = $3 WHERE id = $1`, [uploadId, sensivel, JSON.stringify({ tipoReal: tipo.mime, cnpjs: cnpjsLidos, empresaSugerida: sugeridaFinal, sugestao, avisos })]);
  return { tipoReal: tipo.mime, cnpjs: cnpjsLidos, empresaSugerida: sugeridaFinal, sugestao, avisos };
}

export interface Confirmacao { uploadId: string; empresaId: string; tipoId: string; subtipoId: string | null; competencia?: string | null; sensivel?: boolean }

export async function confirmarEnvio(ator: Ator, c: Confirmacao, agora = new Date()) {
  const u = await uploadDoAtor(ator, c.uploadId);
  if (!u.analise) throw new ErroApi('O arquivo ainda não foi analisado.');
  let empresaId = c.empresaId, tipoId = c.tipoId, subtipoId = c.subtipoId;
  const comPedido = Boolean(u.item_id);
  if (u.item_id) {
    const it = await itemDoAtor(ator, u.item_id);
    empresaId = it.empresa_id; tipoId = it.tipo_id; subtipoId = it.subtipo_id;
  }
  exigirEmpresaDoAtor(ator, empresaId);
  const tipo = await um<{ sensivel: boolean; subtipo_origem: string | null; ativo: boolean }>(`SELECT sensivel, subtipo_origem, ativo FROM tipos_documento WHERE id = $1`, [tipoId]);
  if (!tipo?.ativo) throw new ErroApi('Tipo inválido.');
  // Sem pedido: se o arquivo já passou pela análise com IA, não pode virar sensível depois.
  if (!comPedido && tipo.sensivel && !u.sensivel) throw new ErroApi('Para documento sensível, volte e responda "Sim" à pergunta sobre documento de funcionário.');
  if (subtipoId) {
    const s = await um(`SELECT 1 FROM subtipos WHERE id = $1 AND empresa_id = $2 AND tipo_id = $3`, [subtipoId, empresaId, tipoId]);
    if (!s) throw new ErroApi('Subtipo inválido para esta empresa.');
  }
  const mes = await resolverMes({ itemId: u.item_id, empresaId, tipoId, subtipoId, competenciaEscolhida: c.competencia, agora });
  const dados = await armazenamento().ler(u.chave);
  const analise = u.analise as { sugestao?: unknown; cnpjs?: string[] };
  const r = await registrarEnvio({
    dados, nomeOriginal: u.nome_original, origem: 'app', empresaId, tipoId, subtipoId, competencia: mes.competencia,
    itemId: mes.itemId, comPedido, sensivel: u.sensivel || tipo.sensivel, loginId: ator.loginId, sugestaoPrevia: analise.sugestao ?? null, cnpjsPrevios: analise.cnpjs ?? [],
  });
  await q(`UPDATE uploads SET confirmado_em = now(), documento_id = $2 WHERE id = $1`, [c.uploadId, r.id]);
  await armazenamento().apagar(u.chave).catch(() => undefined);
  const empresa = ator.empresas.find((e) => e.id === empresaId)!;
  return { documentoId: r.id, duplicado: r.duplicado, empresaId, empresaNome: empresa.nome, competencia: mes.competencia };
}

/**
 * "Mudar empresa": só enquanto ninguém do escritório conferiu. Depois disso,
 * só o funcionário move. A mudança fica registrada.
 */
export async function mudarEmpresaDoEnvio(ator: Ator, documentoId: string, novaEmpresaId: string) {
  exigirEmpresaDoAtor(ator, novaEmpresaId);
  await transacao(async (c) => {
    const d = (await c.query<{ empresa_id: string | null; status: string; enviado_por_login: string | null; item_id: string | null; tipo_id: string | null; competencia: string | null; hash_sha256: string; subtipo_id: string | null }>(
      `SELECT empresa_id, status, enviado_por_login, item_id, tipo_id, to_char(competencia, 'YYYY-MM-DD') AS competencia, hash_sha256, subtipo_id FROM documentos WHERE id = $1 FOR UPDATE`, [documentoId])).rows[0];
    if (!d || d.enviado_por_login !== ator.loginId) throw new NaoAutorizado('Documento não encontrado.');
    if (d.empresa_id && !ator.empresas.some((e) => e.id === d.empresa_id)) throw new NaoAutorizado('Documento não encontrado.');
    if (['conferido', 'substituido', 'recusado'].includes(d.status)) throw new ErroApi('O escritório já conferiu este arquivo. Peça ao escritório para mudar.');
    if (d.empresa_id === novaEmpresaId) return;
    const dup = (await c.query(`SELECT 1 FROM documentos WHERE empresa_id = $1 AND hash_sha256 = $2 AND excluido_em IS NULL AND status <> 'recusado'`, [novaEmpresaId, d.hash_sha256])).rows[0];
    if (dup) throw new ErroApi('Este arquivo já foi enviado para essa empresa.');
    if (d.item_id) {
      await c.query(`UPDATE itens_pedido SET documento_id = NULL, status = 'pendente', recebido_em = NULL WHERE id = $1 AND documento_id = $2`, [d.item_id, documentoId]);
    }
    const novoStatus = d.status === 'processando' ? 'processando' : d.tipo_id ? 'a_conferir' : 'nao_reconhecido';
    await c.query(`UPDATE documentos SET empresa_id = $2, subtipo_id = NULL, item_id = NULL, status = $3 WHERE id = $1`, [documentoId, novaEmpresaId, novoStatus]);
    await registrarAuditoria(c, documentoId, 'empresa_trocada_cliente', { empresa_id: d.empresa_id, subtipo_id: d.subtipo_id }, { empresa_id: novaEmpresaId, subtipo_id: null }, { loginId: ator.loginId, quem: ator.nome });
    // Tipo sem subtipo e um item aberto do mesmo mês na nova empresa: entra nele.
    if (d.tipo_id && d.competencia && novoStatus !== 'processando') {
      const it = (await c.query<{ id: string }>(`SELECT id FROM itens_pedido WHERE empresa_id = $1 AND tipo_id = $2 AND subtipo_id IS NULL AND competencia = $3 AND status IN ('pendente', 'refazer')`, [novaEmpresaId, d.tipo_id, d.competencia])).rows[0];
      if (it) await vincularAoItem(c, documentoId, it.id);
    }
  });
}
