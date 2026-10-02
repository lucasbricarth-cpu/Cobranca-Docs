import sharp from 'sharp';
import { q, todos, um, transacao } from '@/lib/db';
import { enfileirar, reagendar, registrarTarefa, dispararFila } from '@/lib/fila';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { registrarAuditoria, vincularAoItem } from '@/lib/documentos/acoes';
import { opcoesDeMes } from '@/lib/envio/mes';
import { decidirSubtipo, type Sugestao } from '@/lib/classificacao';
import { subtiposDaEmpresa } from '@/lib/documentos/subtipos';
import { nomeDoSubtipo, tipoCurto } from '@/lib/documentos/nomes';
import { avaliarQualidade } from '@/components/envio/qualidade';
import { mesPorExtenso, nomeDoMes } from '@/lib/tempo';
import { texto } from '@/lib/notificacoes/textos';
import { canalWhatsApp, type EventoWhatsApp, type Botao } from './canal';
import { loginDoNumero, empresasDoLogin } from './numeros';

/**
 * Arquivo recebido pela conversa do WhatsApp:
 * - o webhook é confirmado na hora e o resto vai para a fila; o id da
 *   mensagem garante que um aviso repetido não vira dois documentos;
 * - o arquivo é baixado IMEDIATAMENTE (o link de mídia da Meta expira em
 *   minutos) e segue o mesmo caminho do upload do app;
 * - só arquivos: texto, áudio e perguntas seguem para a fila humana;
 * - vários arquivos seguidos: espera ~30 s sem arquivo novo e responde uma vez;
 * - confirma empresa (se o número tiver várias), mês (se houver dois ou mais
 *   abertos) e o resultado; sem resposta em algumas horas, vai para Não
 *   reconhecidos — nunca se perde nem é arquivado por palpite.
 */
export const ESPERA_LOTE_MS = Number(process.env.WHATSAPP_ESPERA_LOTE_MS ?? 30_000);
export const PRAZO_RESPOSTA_H = Number(process.env.WHATSAPP_PRAZO_RESPOSTA_H ?? 4);

/* ───────────── webhook ───────────── */

export async function receberWebhook(corpoBruto: string, cabecalhos: Headers): Promise<{ novos: number; repetidos: number } | null> {
  const canal = await canalWhatsApp();
  const eventos = canal.interpretarWebhook(corpoBruto, cabecalhos);
  if (!eventos) return null;
  let novos = 0, repetidos = 0;
  for (const ev of eventos) {
    const r = await um(`INSERT INTO whatsapp_recebidas (id, numero, tipo, payload) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [ev.id, ev.numero, ev.tipo, JSON.stringify(ev)]);
    if (!r) { repetidos++; continue; }
    novos++;
    await enfileirar('whatsapp_evento', { id: ev.id }, { chave: `wa:${ev.id}` });
  }
  dispararFila();
  return { novos, repetidos };
}

async function processarEvento(id: string) {
  const r = await um<{ payload: EventoWhatsApp }>(`SELECT payload FROM whatsapp_recebidas WHERE id = $1`, [id]);
  if (!r) return;
  const ev = r.payload;
  if (ev.tipo === 'arquivo') return receberArquivo(ev);
  if (ev.tipo === 'botao') return responder(ev.numero, ev.botaoId);
  if (ev.tipo === 'texto') {
    // Só vale como resposta se houver pergunta em aberto e o texto for uma das opções; senão é da fila humana.
    const conv = await conversa(ev.numero);
    const opcoes = (conv?.contexto.opcoes as string[] | undefined) ?? [];
    const n = Number(ev.texto.trim());
    if (conv && Number.isInteger(n) && n >= 1 && n <= opcoes.length) return responder(ev.numero, opcoes[n - 1]);
    if (conv?.etapa === 'resultado' && /^\s*(sim|ok|certo|est[aá] certo|isso)\s*!?\s*$/i.test(ev.texto)) return responder(ev.numero, 'ok');
  }
  // Áudio, perguntas e o resto: a plataforma encaminha para o atendimento humano, como hoje.
}

/* ───────────── arquivo e lote ───────────── */

/** Documento sensível pelo contexto: o último pedido mandado a este contato (7 dias) é de tipo sensível e ainda está aberto. */
async function pedidoSensivelRecente(loginId: string) {
  return um<{ item_id: string; empresa_id: string }>(
    `SELECT a.item_id, i.empresa_id FROM avisos a JOIN itens_pedido i ON i.id = a.item_id JOIN tipos_documento t ON t.id = i.tipo_id
     WHERE a.login_id = $1 AND a.canal = 'whatsapp' AND a.status = 'enviado' AND a.enviado_em > now() - interval '7 days'
       AND t.sensivel AND i.status IN ('pendente', 'refazer')
       AND a.enviado_em = (SELECT max(enviado_em) FROM avisos WHERE login_id = $1 AND canal = 'whatsapp' AND status = 'enviado')`, [loginId]);
}

async function receberArquivo(ev: Extract<EventoWhatsApp, { tipo: 'arquivo' }>) {
  const canal = await canalWhatsApp();
  const arquivo = await canal.baixarArquivo(ev.midia);   // na hora: o link da Meta expira em minutos
  const login = await loginDoNumero(ev.numero);
  const empresas = login ? await empresasDoLogin(login.login_id) : [];
  const sensivel = login ? await pedidoSensivelRecente(login.login_id) : null;
  const doc = await registrarEnvio({
    dados: arquivo.dados, nomeOriginal: arquivo.nome, origem: 'whatsapp',
    // Pedido sensível aberto: o arquivo vai para a empresa do pedido, sem perguntar e sem passar pela IA.
    empresaId: sensivel?.empresa_id ?? (empresas.length === 1 ? empresas[0].id : null),
    loginId: login?.login_id ?? null, whatsappNumero: ev.numero,
    sensivel: Boolean(sensivel), itemId: sensivel?.item_id ?? null,
  });
  await q(`UPDATE whatsapp_recebidas SET documento_id = $2 WHERE id = $1`, [ev.id, doc.id]);
  const lote = (await um<{ id: string }>(
    `INSERT INTO whatsapp_lotes (numero, login_id, documentos) VALUES ($1, $2, ARRAY[$3::uuid])
     ON CONFLICT (numero) WHERE fechado_em IS NULL
     DO UPDATE SET documentos = (SELECT array_agg(DISTINCT x) FROM unnest(whatsapp_lotes.documentos || EXCLUDED.documentos) x), ultimo_arquivo = now()
     RETURNING id`, [ev.numero, login?.login_id ?? null, doc.id]))!;
  const quando = new Date(Date.now() + ESPERA_LOTE_MS);
  const novo = await enfileirar('whatsapp_lote', { loteId: lote.id }, { chave: `lote:${lote.id}`, executarEm: quando });
  if (!novo) await reagendar(`lote:${lote.id}`, quando);
}

interface DocLote { id: string; status: string; empresa_id: string | null; tipo_id: string | null; subtipo_id: string | null; competencia: string | null; mime: string; chave: string; sensivel: boolean; cnpjs_lidos: string[] | null; sugestao: { sugerido?: Sugestao; previa?: Sugestao } | null; item_id: string | null }
async function docsDoLote(ids: string[]) {
  return todos<DocLote>(
    `SELECT d.id, d.status, d.empresa_id, d.tipo_id, d.subtipo_id, to_char(d.competencia, 'YYYY-MM-DD') AS competencia, d.mime, d.chave,
            (d.sensivel OR coalesce(t.sensivel, false)) AS sensivel, d.cnpjs_lidos, d.sugestao, d.item_id
     FROM documentos d LEFT JOIN tipos_documento t ON t.id = d.tipo_id WHERE d.id = ANY($1) ORDER BY d.recebido_em`, [ids]);
}

async function processarLote(loteId: string, tentativa = 0) {
  const lote = await um<{ id: string; numero: string; documentos: string[]; fechado_em: Date | null }>(`SELECT id, numero, documentos, fechado_em FROM whatsapp_lotes WHERE id = $1`, [loteId]);
  if (!lote || lote.fechado_em) return;
  let docs = await docsDoLote(lote.documentos);
  if (docs.some((d) => d.status === 'processando') && tentativa < 30) {
    await enfileirar('whatsapp_lote', { loteId, tentativa: tentativa + 1 }, { chave: `lote:${loteId}:${tentativa + 1}`, executarEm: new Date(Date.now() + 10_000) });
    return;
  }
  await q(`UPDATE whatsapp_lotes SET fechado_em = now() WHERE id = $1`, [loteId]);
  const canal = await canalWhatsApp();
  const login = await loginDoNumero(lote.numero);
  docs = docs.filter((d) => d.status !== 'recusado');

  // Número sem vínculo confirmado: pasta geral e só a mensagem genérica, sem empresa nem documento.
  if (!login) {
    await canal.enviarTexto(lote.numero, await texto('wa.recebido.generico'));
    if (canal.recursos.notaInterna) await canal.notaInterna(lote.numero, `Foi para Não reconhecidos (número sem vínculo confirmado): ${docs.length} arquivo(s).`);
    return;
  }

  // Foto ruim: pede de novo, com a dica de mandar como "Documento". O arquivo não se perde.
  const ruins: string[] = [];
  for (const d of docs.filter((x) => x.mime.startsWith('image/') && !x.sensivel)) {
    if (await fotoRuim(d.chave)) ruins.push(d.id);
  }
  if (ruins.length) {
    await q(`UPDATE documentos SET status = 'nao_reconhecido' WHERE id = ANY($1) AND status <> 'conferido'`, [ruins]);
    await canal.enviarTexto(lote.numero, await texto('wa.foto.ruim'));
  }
  const validos = docs.filter((d) => !ruins.includes(d.id));
  if (!validos.length) return;

  const empresas = await empresasDoLogin(login.login_id);
  if (empresas.length > 1 && validos.some((d) => !d.empresa_id)) {
    const cnpjs = new Set(validos.flatMap((d) => d.cnpjs_lidos ?? []));
    const casam = empresas.filter((e) => cnpjs.has(e.cnpj));
    if (casam.length === 1) {
      await perguntar(lote.numero, loteId, 'empresa', { docs: validos.map((d) => d.id), sugerida: casam[0].id, empresas: empresas.map((e) => e.id) },
        await texto('wa.pergunta.empresa.sugerida', { empresa: casam[0].nome }), [{ id: 'emp_sim', titulo: 'Sim' }, { id: 'emp_outra', titulo: 'Não, é outra' }]);
    } else {
      await perguntarEmpresa(lote.numero, loteId, validos.map((d) => d.id), empresas);
    }
    return;
  }
  await seguirParaMes(lote.numero, loteId, validos.map((d) => d.id));
}

async function fotoRuim(chave: string): Promise<boolean> {
  try {
    const { armazenamento } = await import('@/lib/armazenamento');
    const { data, info } = await sharp(await armazenamento().ler(chave)).rotate().resize(400, 400, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const qd = avaliarQualidade({ data, width: info.width, height: info.height }, [{ x: 10, y: 10 }, { x: info.width - 10, y: 10 }, { x: info.width - 10, y: info.height - 10 }, { x: 10, y: info.height - 10 }]);
    return qd.tremida || qd.escura;
  } catch { return false; }
}

/* ───────────── perguntas ───────────── */

async function perguntar(numero: string, loteId: string, etapa: 'empresa' | 'mes' | 'resultado', contexto: Record<string, unknown>, pergunta: string, botoes: Botao[]) {
  const canal = await canalWhatsApp();
  const expira = new Date(Date.now() + PRAZO_RESPOSTA_H * 3600_000);
  const r = await um<{ perguntado_em: Date }>(
    `INSERT INTO whatsapp_conversas (numero, lote_id, etapa, contexto, perguntado_em, expira_em) VALUES ($1, $2, $3, $4, now(), $5)
     ON CONFLICT (numero) DO UPDATE SET lote_id = EXCLUDED.lote_id, etapa = EXCLUDED.etapa, contexto = EXCLUDED.contexto, perguntado_em = now(), expira_em = EXCLUDED.expira_em
     RETURNING perguntado_em`, [numero, loteId, etapa, JSON.stringify({ ...contexto, opcoes: botoes.map((b) => b.id) }), expira]);
  if (canal.recursos.botoes) await canal.enviarBotoes(numero, pergunta, botoes);
  else await canal.enviarTexto(numero, `${pergunta}\n${botoes.map((b, i) => `${i + 1}. ${b.titulo}`).join('\n')}\nResponda com o número.`);
  await enfileirar('whatsapp_expirar', { numero, perguntadoEm: r!.perguntado_em.toISOString() }, { chave: `expirar:${numero}:${r!.perguntado_em.toISOString()}`, executarEm: expira });
}

async function perguntarEmpresa(numero: string, loteId: string, docs: string[], empresas: { id: string; nome: string }[]) {
  // Nada vem marcado: o cliente escolhe.
  await perguntar(numero, loteId, 'empresa', { docs, empresas: empresas.map((e) => e.id) }, await texto('wa.pergunta.empresa'),
    empresas.map((e) => ({ id: `emp:${e.id}`, titulo: e.nome.slice(0, 24), descricao: e.nome })));
}

async function conversa(numero: string) {
  return um<{ lote_id: string; etapa: 'empresa' | 'mes' | 'resultado'; contexto: Record<string, unknown>; perguntado_em: Date }>(
    `SELECT lote_id, etapa, contexto, perguntado_em FROM whatsapp_conversas WHERE numero = $1 AND expira_em > now()`, [numero]);
}

/** O cliente respondeu (botão, lista ou o número da opção). Toda escolha é validada contra o que foi perguntado. */
export async function responder(numero: string, botaoId: string) {
  const conv = await conversa(numero);
  if (!conv || !((conv.contexto.opcoes as string[]) ?? []).includes(botaoId)) return;
  const login = await loginDoNumero(numero);
  if (!login) return;
  const docs = (conv.contexto.docs as string[]) ?? [];
  if (conv.etapa === 'empresa') {
    if (botaoId === 'emp_outra') {
      const empresas = await empresasDoLogin(login.login_id);
      return perguntarEmpresa(numero, conv.lote_id, docs, empresas);
    }
    const empresaId = botaoId === 'emp_sim' ? String(conv.contexto.sugerida) : botaoId.slice(4);
    // A empresa precisa estar nos vínculos do login deste número (nunca confia no que veio).
    if (!(conv.contexto.empresas as string[]).includes(empresaId)) return;
    await q(`DELETE FROM whatsapp_conversas WHERE numero = $1`, [numero]);
    await aplicarEmpresa(docs, empresaId, login);
    return seguirParaMes(numero, conv.lote_id, docs);
  }
  if (conv.etapa === 'mes') {
    const [, docId, comp] = botaoId.split(':');
    const meses = conv.contexto.meses as { competencia: string; itemId: string }[];
    const m = meses.find((x) => x.competencia === comp);
    if (docId !== conv.contexto.doc || !m) return;
    await q(`DELETE FROM whatsapp_conversas WHERE numero = $1`, [numero]);
    await transacao(async (c) => {
      await c.query(`UPDATE documentos SET competencia = $2 WHERE id = $1`, [docId, comp]);
      await vincularAoItem(c, docId, m.itemId);
    });
    return seguirParaMes(numero, conv.lote_id, docs);
  }
  if (conv.etapa === 'resultado') {
    await q(`DELETE FROM whatsapp_conversas WHERE numero = $1`, [numero]);
    const canal = await canalWhatsApp();
    if (botaoId === 'ok') {
      await canal.enviarTexto(numero, 'Obrigado! O escritório vai conferir.');
      if (canal.recursos.notaInterna) await canal.notaInterna(numero, `Cliente confirmou. ${await descreverArquivamento(docs)}`);
    } else {
      await canal.enviarTexto(numero, 'Certo! A nossa equipe vai conferir e ajustar.');
      if (canal.recursos.notaInterna) await canal.notaInterna(numero, `Cliente pediu correção. ${await descreverArquivamento(docs)}`);
    }
  }
}

/** Empresa escolhida: o documento vai para ela e o subtipo é decidido pelo código com o que foi lido. */
async function aplicarEmpresa(docs: string[], empresaId: string, login: { login_id: string; nome: string }) {
  for (const d of await docsDoLote(docs)) {
    if (d.empresa_id) continue;
    const sg = d.sugestao?.sugerido ?? d.sugestao?.previa ?? null;
    let subtipoId: string | null = null;
    if (d.tipo_id && sg?.lido && !d.sensivel) subtipoId = decidirSubtipo(sg.lido, await subtiposDaEmpresa(empresaId, d.tipo_id), d.tipo_id).subtipoId;
    const dup = await um(`SELECT 1 FROM documentos d2 JOIN documentos d1 ON d1.hash_sha256 = d2.hash_sha256 WHERE d1.id = $1 AND d2.empresa_id = $2 AND d2.excluido_em IS NULL AND d2.status <> 'recusado'`, [d.id, empresaId]);
    if (dup) continue; // o mesmo arquivo já está nessa empresa: não vira dois
    await transacao(async (c) => {
      await c.query(`UPDATE documentos SET empresa_id = $2, subtipo_id = $3, status = CASE WHEN tipo_id IS NULL THEN 'nao_reconhecido' ELSE 'a_conferir' END WHERE id = $1`, [d.id, empresaId, subtipoId]);
      await registrarAuditoria(c, d.id, 'empresa_whatsapp', { empresa_id: null }, { empresa_id: empresaId, subtipo_id: subtipoId }, { loginId: login.login_id, quem: `${login.nome} (WhatsApp)` });
    });
  }
}

/** Mês: item único aberto → vai para ele; vários → pergunta; nenhum → regra do tipo. O mês nunca vem da IA. */
async function seguirParaMes(numero: string, loteId: string, ids: string[]) {
  for (const d of await docsDoLote(ids)) {
    if (!d.empresa_id || !d.tipo_id || d.competencia || d.item_id || d.status === 'conferido') continue;
    const o = await opcoesDeMes({ empresaId: d.empresa_id, tipoId: d.tipo_id, subtipoId: d.subtipo_id });
    if (o.modo === 'item') {
      await transacao(async (c) => { await c.query(`UPDATE documentos SET competencia = $2 WHERE id = $1`, [d.id, o.competencia]); await vincularAoItem(c, d.id, o.itemId); });
    } else if (o.modo === 'regra') {
      await q(`UPDATE documentos SET competencia = $2 WHERE id = $1`, [d.id, o.competencia]);
    } else if (o.modo === 'escolher') {
      return perguntar(numero, loteId, 'mes', { docs: ids, doc: d.id, meses: o.meses }, await texto('wa.pergunta.mes'),
        o.meses.map((m) => ({ id: `mes:${d.id}:${m.competencia}`, titulo: nomeDoMes(m.competencia) })));
    }
  }
  return enviarResultado(numero, loteId, ids);
}

async function rotuloDoDoc(d: DocLote): Promise<string> {
  const t = d.tipo_id ? await um<{ nome: string }>(`SELECT nome FROM tipos_documento WHERE id = $1`, [d.tipo_id]) : null;
  const s = d.subtipo_id ? (await subtiposDaEmpresa(d.empresa_id!, d.tipo_id!)).find((x) => x.id === d.subtipo_id) : null;
  const sub = s ? nomeDoSubtipo(s).replace(/ final (\d+)$/, ' (final $1)') : '';
  return `${t ? tipoCurto(t.nome) : 'Documento'}${sub ? ` ${sub}` : ''}${d.competencia ? `, ${mesPorExtenso(d.competencia)}` : ''}`;
}

/** "Recebemos: Extrato Itaú (final 0567), setembro/2026. Está certo?" — sensível diz só "Recebemos o seu documento". */
async function enviarResultado(numero: string, loteId: string, ids: string[]) {
  const canal = await canalWhatsApp();
  const docs = (await docsDoLote(ids)).filter((d) => d.status !== 'recusado');
  const identificados = docs.filter((d) => d.empresa_id && d.tipo_id && !d.sensivel);
  const sensiveis = docs.filter((d) => d.sensivel);
  const semTipo = docs.filter((d) => !d.sensivel && (!d.tipo_id || !d.empresa_id));
  if (!identificados.length) {
    if (sensiveis.length) await canal.enviarTexto(numero, await texto('wa.recebido.sensivel'));
    else await canal.enviarTexto(numero, await texto('wa.recebido.generico'));
    if (canal.recursos.notaInterna) await canal.notaInterna(numero, await descreverArquivamento(ids));
    return;
  }
  const linhas = await Promise.all(identificados.map(rotuloDoDoc));
  const extra = [
    sensiveis.length ? `Recebemos também ${sensiveis.length === 1 ? 'o seu documento' : `${sensiveis.length} documentos`}.` : '',
    semTipo.length ? `${semTipo.length} arquivo(s) a nossa equipe vai conferir.` : '',
  ].filter(Boolean).join(' ');
  const pergunta = linhas.length === 1
    ? `${await texto('wa.resultado', { documento: linhas[0].split(', ')[0], mes: linhas[0].split(', ')[1] ?? '' })}${extra ? `\n${extra}` : ''}`
    : `Recebemos:\n${linhas.map((l) => `• ${l}`).join('\n')}${extra ? `\n${extra}` : ''}\nEstá certo?`;
  await perguntar(numero, loteId, 'resultado', { docs: ids }, pergunta.replace(/, \./, '.'), [{ id: 'ok', titulo: 'Está certo' }, { id: 'corrigir', titulo: 'Corrigir' }]);
}

/** Nota interna: "Arquivado em Extratos › Itaú final 0567 › Setembro 2026" ou "Foi para Não reconhecidos". */
async function descreverArquivamento(ids: string[]): Promise<string> {
  const partes: string[] = [];
  for (const d of await docsDoLote(ids)) {
    if (d.status === 'nao_reconhecido' || !d.tipo_id || !d.empresa_id) { partes.push('Foi para Não reconhecidos'); continue; }
    const t = await um<{ nome: string }>(`SELECT nome FROM tipos_documento WHERE id = $1`, [d.tipo_id]);
    const s = d.subtipo_id ? (await subtiposDaEmpresa(d.empresa_id, d.tipo_id)).find((x) => x.id === d.subtipo_id) : null;
    partes.push(`Arquivado em ${[t?.nome, s ? nomeDoSubtipo(s) : null, d.competencia ? nomeDoMes(d.competencia) : null].filter(Boolean).join(' › ')}`);
  }
  return partes.join('; ');
}

/** Sem resposta em algumas horas: os arquivos da pergunta vão para Não reconhecidos. Nada se perde. */
async function expirar(numero: string, perguntadoEm: string) {
  const conv = await um<{ contexto: Record<string, unknown>; perguntado_em: Date }>(`SELECT contexto, perguntado_em FROM whatsapp_conversas WHERE numero = $1`, [numero]);
  if (!conv || conv.perguntado_em.toISOString() !== perguntadoEm) return;
  await q(`DELETE FROM whatsapp_conversas WHERE numero = $1`, [numero]);
  const docs = (conv.contexto.docs as string[]) ?? [];
  await q(`UPDATE documentos SET status = 'nao_reconhecido' WHERE id = ANY($1) AND status IN ('a_conferir', 'nao_reconhecido')`, [docs]);
  const canal = await canalWhatsApp();
  if (canal.recursos.notaInterna) await canal.notaInterna(numero, `Sem resposta do cliente: ${docs.length} arquivo(s) foram para Não reconhecidos.`);
}

registrarTarefa('whatsapp_evento', async (d) => processarEvento(String(d.id)));
registrarTarefa('whatsapp_lote', async (d) => processarLote(String(d.loteId), Number(d.tentativa ?? 0)));
registrarTarefa('whatsapp_expirar', async (d) => expirar(String(d.numero), String(d.perguntadoEm)));
