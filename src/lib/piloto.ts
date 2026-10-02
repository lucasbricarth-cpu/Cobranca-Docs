import { todos, um, q } from '@/lib/db';
import { dataSP, somarDias } from '@/lib/tempo';

/**
 * Piloto (Etapa 10). [DECIDIR] quais empresas: poucas, de responsáveis
 * diferentes, durante um mês. Marcadas aqui, o app entra em modo piloto
 * (agenda e avisos automáticos só para elas). As métricas dizem quando ampliar
 * e que tipos podem ligar o arquivamento automático.
 * Datas e períodos no fuso de São Paulo.
 */

export async function empresasDoPiloto() {
  return todos<{ id: string; nome: string; cnpj: string; responsavel: string | null; responsavel_id: string | null }>(
    `SELECT e.id, e.nome, e.cnpj, u.nome AS responsavel, e.responsavel_id FROM empresas e LEFT JOIN usuarios u ON u.id = e.responsavel_id
     WHERE e.piloto ORDER BY e.nome`);
}
export async function marcarPiloto(empresaId: string, piloto: boolean) {
  await q(`UPDATE empresas SET piloto = $2 WHERE id = $1`, [empresaId, piloto]);
}
export async function modoPiloto(): Promise<boolean> {
  return Boolean(await um(`SELECT 1 FROM empresas WHERE piloto LIMIT 1`));
}

export interface MetricaTipo {
  tipo_id: string; tipo: string; sensivel: boolean;
  itens: number; enviados: number; no_prazo: number; atrasados_abertos: number; rejeitados: number;
  mediana_h: number | null; p90_h: number | null; pelo_whatsapp: number;
  ia_total: number; ia_acertos_tipo: number; ia_com_subtipo: number; ia_acertos_subtipo: number;
}

/**
 * Por tipo, no período (itens criados entre `desde` e `ate`, datas de São Paulo):
 * - tempo até o envio: do pedido (item criado) ao PRIMEIRO arquivo recebido;
 * - no prazo: primeiro arquivo até o fim do dia do prazo;
 * - rejeitados: itens com pelo menos um envio recusado pelo escritório ("Refazer");
 * - acerto da IA: conferências com sugestão (correções), do mesmo período.
 */
export async function metricas(o: { desde: string; ate: string; soPiloto: boolean }): Promise<MetricaTipo[]> {
  const hoje = dataSP();
  const filtroEmp = o.soPiloto ? 'AND e.piloto' : '';
  return todos<MetricaTipo>(
    `WITH itens AS (
       SELECT i.id, i.tipo_id, i.status, i.prazo, i.criado_em,
              (SELECT min(d.recebido_em) FROM documentos d WHERE d.item_id = i.id AND d.status <> 'recusado') AS primeiro,
              (SELECT d.origem FROM documentos d WHERE d.item_id = i.id AND d.status <> 'recusado' ORDER BY d.recebido_em LIMIT 1) AS origem,
              EXISTS (SELECT 1 FROM documentos d WHERE d.item_id = i.id AND d.motivo_rejeicao IS NOT NULL)
                OR EXISTS (SELECT 1 FROM auditoria_documentos a JOIN documentos d ON d.id = a.documento_id WHERE d.item_id = i.id AND a.acao = 'rejeitado') AS rejeitado
       FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id
       WHERE i.status <> 'cancelado' ${filtroEmp}
         AND timezone('America/Sao_Paulo', i.criado_em)::date BETWEEN $1::date AND $2::date
     ), ia AS (
       SELECT c.tipo_final AS tipo_id, count(*)::int AS total, count(*) FILTER (WHERE c.acertou_tipo)::int AS acertos_tipo,
              count(c.acertou_subtipo)::int AS com_subtipo, count(*) FILTER (WHERE c.acertou_subtipo)::int AS acertos_subtipo
       FROM correcoes_classificacao c JOIN documentos d ON d.id = c.documento_id JOIN empresas e ON e.id = d.empresa_id
       WHERE timezone('America/Sao_Paulo', c.em)::date BETWEEN $1::date AND $2::date ${filtroEmp}
       GROUP BY c.tipo_final
     )
     SELECT t.id AS tipo_id, t.nome AS tipo, t.sensivel,
            count(x.id)::int AS itens, count(x.primeiro)::int AS enviados,
            count(*) FILTER (WHERE x.primeiro IS NOT NULL AND (x.prazo IS NULL OR timezone('America/Sao_Paulo', x.primeiro)::date <= x.prazo))::int AS no_prazo,
            count(*) FILTER (WHERE x.primeiro IS NULL AND x.status IN ('pendente', 'refazer') AND x.prazo < $3::date)::int AS atrasados_abertos,
            count(*) FILTER (WHERE x.rejeitado)::int AS rejeitados,
            round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM x.primeiro - x.criado_em) / 3600))::numeric, 1)::float AS mediana_h,
            round((percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM x.primeiro - x.criado_em) / 3600))::numeric, 1)::float AS p90_h,
            count(*) FILTER (WHERE x.origem = 'whatsapp')::int AS pelo_whatsapp,
            coalesce(ia.total, 0) AS ia_total, coalesce(ia.acertos_tipo, 0) AS ia_acertos_tipo,
            coalesce(ia.com_subtipo, 0) AS ia_com_subtipo, coalesce(ia.acertos_subtipo, 0) AS ia_acertos_subtipo
     FROM tipos_documento t LEFT JOIN itens x ON x.tipo_id = t.id LEFT JOIN ia ON ia.tipo_id = t.id
     WHERE t.ativo
     GROUP BY t.id, ia.total, ia.acertos_tipo, ia.com_subtipo, ia.acertos_subtipo
     ORDER BY t.ordem`, [o.desde, o.ate, hoje]);
}

/** Mensagens-modelo de WhatsApp por dia (últimos N dias, São Paulo), para subir o volume aos poucos. */
export async function volumeWhatsApp(dias = 14) {
  const hoje = dataSP();
  const desde = somarDias(hoje, -(dias - 1));
  const linhas = await todos<{ dia: string; enviados: number }>(
    `SELECT to_char(timezone('America/Sao_Paulo', enviado_em)::date, 'YYYY-MM-DD') AS dia, count(*)::int AS enviados
     FROM avisos WHERE canal = 'whatsapp' AND status = 'enviado' AND timezone('America/Sao_Paulo', enviado_em)::date >= $1::date
     GROUP BY 1`, [desde]);
  const m = new Map(linhas.map((l) => [l.dia, l.enviados]));
  return Array.from({ length: dias }, (_, i) => { const dia = somarDias(desde, i); return { dia, enviados: m.get(dia) ?? 0 }; });
}
