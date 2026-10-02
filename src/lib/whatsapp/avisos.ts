import { todos, um, q } from '@/lib/db';
import { texto } from '@/lib/notificacoes/textos';
import { criarLinkEnvio } from '@/lib/envio/ator';
import { mesPorExtenso, dataCurta, hojeSP } from '@/lib/tempo';
import { canalWhatsApp } from './canal';
import { temAceite } from './numeros';

/**
 * Pedidos e lembretes pelo WhatsApp: mensagens-modelo da categoria
 * Utilidade, aprovadas na conta. Régua mais curta que push e e-mail: só o
 * pedido e o lembrete no dia do prazo. Tom informativo, saudação neutra na
 * primeira linha, botão "Enviar pelo app" com o pedido no fim do link.
 * Sem aceite registrado, nada automático sai pelo WhatsApp para o contato.
 * O volume sobe aos poucos (WHATSAPP_LIMITE_DIARIO): o número é o do atendimento inteiro.
 */
export const ETAPAS_WHATSAPP = new Set(['criado', 'dia']);
const MODELO: Record<string, { nome: string; texto: string }> = {
  criado: { nome: 'pedido_documento', texto: 'wa.pedido' },
  dia: { nome: 'lembrete_prazo_hoje', texto: 'wa.lembrete.dia' },
};

async function enviadosHoje(): Promise<number> {
  const r = await um<{ n: number }>(`SELECT count(*)::int AS n FROM avisos WHERE canal = 'whatsapp' AND status = 'enviado' AND (enviado_em AT TIME ZONE 'America/Sao_Paulo')::date = $1`, [hojeSP()]);
  return r?.n ?? 0;
}

export async function avisarPorWhatsApp(loginId: string, itemIds: string[], etapa: string): Promise<'enviado' | 'sem_aceite' | 'sem_destino' | 'limite' | 'nada'> {
  if (!ETAPAS_WHATSAPP.has(etapa) || !itemIds.length) return 'nada';
  const numero = await um<{ numero: string }>(`SELECT numero FROM numeros_whatsapp WHERE login_id = $1 AND ativo ORDER BY confirmado_em DESC LIMIT 1`, [loginId]);
  const reservar = async (status: string) => todos<{ item_id: string }>(
    `INSERT INTO avisos (item_id, login_id, canal, etapa, destino, status) SELECT unnest($1::uuid[]), $2, 'whatsapp', $3, $4, $5
     ON CONFLICT ON CONSTRAINT aviso_unico DO NOTHING RETURNING item_id`, [itemIds, loginId, etapa, numero?.numero ?? null, status]);
  if (!numero) { await reservar('sem_destino'); return 'sem_destino'; }
  if (!(await temAceite(loginId))) { await reservar('sem_aceite'); return 'sem_aceite'; }
  const limite = Number(process.env.WHATSAPP_LIMITE_DIARIO ?? 50);
  if ((await enviadosHoje()) >= limite) return 'limite'; // não reserva: tenta de novo no próximo dia (push e e-mail já saíram)
  const novos = (await reservar('enviado')).map((r) => r.item_id);
  if (!novos.length) return 'nada';
  // Uma mensagem por empresa: o modelo fala de uma empresa e de um mês.
  const itens = await todos<{ id: string; empresa_id: string; empresa: string; competencia: string; prazo: string | null; nome: string }>(
    `SELECT i.id, i.empresa_id, e.nome AS empresa, to_char(i.competencia, 'YYYY-MM-DD') AS competencia, to_char(i.prazo, 'YYYY-MM-DD') AS prazo, l.nome
     FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id JOIN logins_cliente l ON l.id = $2 WHERE i.id = ANY($1) ORDER BY e.nome, i.competencia`, [novos, loginId]);
  const porEmpresa = new Map<string, typeof itens>();
  for (const i of itens) porEmpresa.set(i.empresa_id, [...(porEmpresa.get(i.empresa_id) ?? []), i]);
  const canal = await canalWhatsApp();
  for (const [empresaId, lista] of porEmpresa) {
    const primeiro = lista[0];
    // "Enviar pelo app": link de envio só daquele pedido (o histórico pede a entrada com passkey).
    const token = await criarLinkEnvio({ loginId, empresaId, itemId: lista.length === 1 ? primeiro.id : null, origem: 'whatsapp' });
    const vars = { nome: primeiro.nome.split(' ')[0], empresa: primeiro.empresa, mes: mesPorExtenso(primeiro.competencia), prazo: primeiro.prazo ? dataCurta(primeiro.prazo, true) : 'o quanto antes' };
    try {
      await canal.enviarModelo(numero.numero, {
        nome: MODELO[etapa].nome, idioma: 'pt_BR', variaveis: [vars.nome, vars.empresa, vars.mes, vars.prazo], botaoUrlSufixo: token,
        textoRenderizado: await texto(MODELO[etapa].texto, vars),
      });
    } catch (e) {
      await q(`UPDATE avisos SET status = 'falhou', erro = $3 WHERE login_id = $1 AND canal = 'whatsapp' AND etapa = $2 AND item_id = ANY($4)`, [loginId, etapa, (e as Error).message.slice(0, 300), lista.map((x) => x.id)]);
    }
  }
  return 'enviado';
}
