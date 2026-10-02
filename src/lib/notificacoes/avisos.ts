import { q, todos, um } from '@/lib/db';
import { enviarEmail } from './email';
import { enviarPush } from './push';
import { texto } from './textos';
import { criarLinkMagico } from '@/lib/auth/magico';
import { avisarPorWhatsApp } from '@/lib/whatsapp/avisos';
import { dataSP as dataSPde, somarDias, dataCurta, mesPorExtenso } from '@/lib/tempo';

/**
 * Avisos aos clientes e ao escritório.
 * - Cada aviso sai UMA vez por item, canal, etapa e destinatário: a chave
 *   única em `avisos` garante, e a linha fica como prova da cobrança.
 * - O texto é genérico: nunca o conteúdo do documento, o banco, o valor nem
 *   o tipo. O detalhe só aparece depois de entrar.
 * - O link do e-mail abre direto o item, vale só para aquele login e expira.
 * - O cliente recebe push (se ativou) e e-mail; quem não ativou o push recebe pelo e-mail.
 */
export type EtapaCliente = 'criado' | '3dias' | 'dia' | 'atraso' | `refazer:${string}`;

const TEXTO_PUSH: Record<string, string> = { criado: 'push.pedido.criado', '3dias': 'push.pedido.3dias', dia: 'push.pedido.dia', atraso: 'push.pedido.atraso' };
const TITULO_EMAIL: Record<string, string> = {
  criado: 'Você tem um novo pedido do escritório.',
  '3dias': 'Um pedido do escritório vence em 3 dias.',
  dia: 'Um pedido do escritório vence hoje.',
  atraso: 'Um pedido do escritório está atrasado.',
};

/** Reserva os avisos (um por item/canal/etapa/login). Devolve só os que ainda não tinham saído. */
async function reservar(itemIds: string[], loginId: string, canal: 'push' | 'email', etapa: string, destino: string | null): Promise<string[]> {
  if (!itemIds.length) return [];
  const r = await todos<{ item_id: string }>(
    `INSERT INTO avisos (item_id, login_id, canal, etapa, destino, status)
     SELECT unnest($1::uuid[]), $2, $3, $4, $5, 'enviado'
     ON CONFLICT ON CONSTRAINT aviso_unico DO NOTHING RETURNING item_id`, [itemIds, loginId, canal, etapa, destino]);
  return r.map((x) => x.item_id);
}

/**
 * Avisa os logins ativos das empresas dos itens. Itens do mesmo login e da
 * mesma etapa saem numa mensagem só (mas cada item fica registrado).
 */
export async function avisarClientes(itemIds: string[], etapa: EtapaCliente): Promise<{ emails: number; pushes: number; whatsapp?: number }> {
  if (!itemIds.length) return { emails: 0, pushes: 0 };
  const destinos = await todos<{ login_id: string; nome: string; email: string; item_id: string; empresa: string; competencia: string }>(
    `SELECT l.id AS login_id, l.nome, l.email, i.id AS item_id, e.nome AS empresa, to_char(i.competencia, 'YYYY-MM-DD') AS competencia
     FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id
     JOIN vinculos_login_empresa v ON v.empresa_id = i.empresa_id JOIN logins_cliente l ON l.id = v.login_id AND l.ativo
     WHERE i.id = ANY($1) AND (i.status IN ('pendente', 'refazer'))`, [itemIds]);
  const porLogin = new Map<string, typeof destinos>();
  for (const d of destinos) porLogin.set(d.login_id, [...(porLogin.get(d.login_id) ?? []), d]);
  const base = etapa.startsWith('refazer') ? 'refazer' : etapa;
  let emails = 0, pushes = 0, whatsapp = 0;
  for (const [loginId, itens] of porLogin) {
    const ids = [...new Set(itens.map((i) => i.item_id))];
    const nome = itens[0].nome.split(' ')[0];
    // Destino do link: o item (um só) ou a lista de pendentes.
    const destino = ids.length === 1 ? `/cliente/item/${ids[0]}` : '/cliente';

    const novosPush = await reservar(ids, loginId, 'push', etapa, null);
    if (novosPush.length) {
      const corpo = base === 'refazer' ? await texto('push.refazer') : await texto(TEXTO_PUSH[base]);
      const r = await enviarPush({ loginId }, { title: 'Portal de Documentos', body: novosPush.length > 1 && base === 'criado' ? `Você tem ${novosPush.length} novos pedidos do escritório.` : corpo, url: destino, tag: `itens-${etapa}` });
      if (r.semAssinatura) await q(`UPDATE avisos SET status = 'sem_destino' WHERE login_id = $1 AND canal = 'push' AND etapa = $2 AND item_id = ANY($3)`, [loginId, etapa, novosPush]);
      else pushes++;
    }

    const novosEmail = await reservar(ids, loginId, 'email', etapa, itens[0].email);
    if (novosEmail.length) {
      // Link do e-mail: abre o item, só para este login, e expira em 3 dias.
      const token = await criarLinkMagico('cliente', loginId, destino, '3 days');
      const titulo = base === 'refazer' ? 'O escritório pediu para refazer um envio.' : novosEmail.length > 1 && base === 'criado' ? `Você tem ${novosEmail.length} novos pedidos do escritório.` : TITULO_EMAIL[base];
      try {
        await enviarEmail({
          para: itens[0].email,
          assunto: await texto('email.pedido.assunto', { titulo }),
          corpo: await texto('email.pedido.corpo', { nome, titulo, link: `${process.env.APP_URL ?? ''}/e/${token}` }),
        });
        emails++;
      } catch (e) {
        await q(`UPDATE avisos SET status = 'falhou', erro = $4 WHERE login_id = $1 AND canal = 'email' AND etapa = $2 AND item_id = ANY($3)`, [loginId, etapa, novosEmail, (e as Error).message.slice(0, 300)]);
      }
    }
    // WhatsApp: só o pedido e o lembrete do dia, e só com número confirmado e aceite.
    if ((await avisarPorWhatsApp(loginId, ids, etapa)) === 'enviado') whatsapp++;
  }
  return { emails, pushes, ...(whatsapp ? { whatsapp } : {}) };
}

/** Lembretes do dia (job diário): 3 dias antes, no dia e depois do atraso. Param quando o item é recebido. */
export async function lembretesDoDia(agora: Date = new Date()) {
  const hoje = dataSPde(agora);
  const dia = (d: string) => todos<{ id: string }>(`SELECT id FROM itens_pedido WHERE status IN ('pendente', 'refazer') AND prazo = $1`, [d]);
  const atrasados = await todos<{ id: string }>(`SELECT id FROM itens_pedido WHERE status IN ('pendente', 'refazer') AND prazo < $1`, [hoje]);
  const r3 = await avisarClientes((await dia(somarDias(hoje, 3))).map((x) => x.id), '3dias');
  const rd = await avisarClientes((await dia(hoje)).map((x) => x.id), 'dia');
  const ra = await avisarClientes(atrasados.map((x) => x.id), 'atraso');
  return { '3dias': r3, dia: rd, atraso: ra };
}

/** Funcionário: chegou arquivo para conferir nas empresas dele (push e notificação no computador). */
export async function avisarConferir(documentoId: string) {
  const d = await um<{ empresa_id: string | null; status: string; empresa: string | null; responsavel_id: string | null }>(
    `SELECT d.empresa_id, d.status, e.nome AS empresa, e.responsavel_id FROM documentos d LEFT JOIN empresas e ON e.id = d.empresa_id WHERE d.id = $1`, [documentoId]);
  if (!d || !['a_conferir', 'nao_reconhecido'].includes(d.status)) return 0;
  // Sem empresa (pasta geral): os Admins. Com empresa: o responsável (ou os Admins, se não houver).
  const destinatarios = d.responsavel_id ? [d.responsavel_id]
    : (await todos<{ id: string }>(`SELECT id FROM usuarios WHERE papel = 'admin' AND ativo`)).map((u) => u.id);
  let n = 0;
  for (const usuarioId of destinatarios) {
    const r = await um(`INSERT INTO avisos (documento_id, usuario_id, canal, etapa, status) VALUES ($1, $2, 'push', 'conferir', 'enviado')
                        ON CONFLICT ON CONSTRAINT aviso_unico DO NOTHING RETURNING id`, [documentoId, usuarioId]);
    if (!r) continue;
    const corpo = d.empresa ? await texto('push.conferir', { empresa: d.empresa }) : 'Chegou um arquivo sem empresa identificada.';
    await enviarPush({ usuarioId }, { title: 'A conferir', body: corpo, url: `/conferir?doc=${documentoId}${d.status === 'nao_reconhecido' ? '&aba=nao' : ''}`, tag: 'conferir' });
    n++;
  }
  return n;
}

/** Resumo diário por e-mail para cada funcionário (uma vez por dia). */
export async function resumoDiario(agora: Date = new Date()) {
  const hoje = dataSPde(agora);
  const usuarios = await todos<{ id: string; nome: string; email: string; papel: string }>(`SELECT id, nome, email, papel FROM usuarios WHERE ativo AND resumo_diario`);
  let enviados = 0;
  for (const u of usuarios) {
    const filtro = u.papel === 'admin' ? '$1::uuid IS NOT NULL' : 'e.responsavel_id = $1::uuid';
    const c = await um<{ conferir: number; atrasados: number; semana: number }>(
      `SELECT (SELECT count(*)::int FROM documentos d LEFT JOIN empresas e ON e.id = d.empresa_id WHERE d.status IN ('a_conferir', 'nao_reconhecido') AND d.excluido_em IS NULL AND (${filtro} OR (d.empresa_id IS NULL AND $3))) AS conferir,
              (SELECT count(*)::int FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id WHERE i.status IN ('pendente', 'refazer') AND i.prazo < $2 AND ${filtro}) AS atrasados,
              (SELECT count(*)::int FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id WHERE i.status IN ('pendente', 'refazer') AND i.prazo BETWEEN $2 AND ($2::date + 6) AND ${filtro}) AS semana`,
      [u.id, hoje, u.papel === 'admin']);
    if (!c || c.conferir + c.atrasados + c.semana === 0) continue;
    const r = await um(`INSERT INTO avisos (usuario_id, canal, etapa, destino, status) VALUES ($1, 'email', $2, $3, 'enviado')
                        ON CONFLICT ON CONSTRAINT aviso_unico DO NOTHING RETURNING id`, [u.id, `resumo:${hoje}`, u.email]);
    if (!r) continue;
    const vars = { nome: u.nome.split(' ')[0], conferir: c.conferir, atrasados: c.atrasados, semana: c.semana, link: `${process.env.APP_URL ?? ''}/inicio` };
    await enviarEmail({ para: u.email, assunto: await texto('email.resumo.assunto', vars), corpo: await texto('email.resumo.corpo', vars) });
    enviados++;
  }
  return { enviados, dia: dataCurta(hoje, true), mes: mesPorExtenso(`${hoje.slice(0, 8)}01`) };
}
