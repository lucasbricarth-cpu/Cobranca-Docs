import { transacao, todos, q, um } from '@/lib/db';
import { criarPedido } from '@/lib/pedidos';
import { partesSP, somarMeses } from '@/lib/tempo';
import { aoCriarItens } from '@/lib/notificacoes/gatilhos';

/**
 * Agenda: modelos recorrentes por perfil de empresa, aplicados a cada
 * empresa e editáveis por empresa. O job diário (no fuso de São Paulo)
 * cria os pedidos do dia, repetindo para todos os subtipos ativos. Rodar
 * duas vezes no mesmo dia não duplica nada (restrição única dos itens).
 */
export interface Modelo { id: string; perfil: string; tipo_id: string; tipo_nome: string; dia_criacao: number; dia_prazo: number; meses_competencia: number; mensagem: string | null; ativo: boolean }

export async function listarModelos(): Promise<Modelo[]> {
  return todos<Modelo>(
    `SELECT m.id, m.perfil, m.tipo_id, t.nome AS tipo_nome, m.dia_criacao, m.dia_prazo, m.meses_competencia, m.mensagem, m.ativo
     FROM modelos_agenda m JOIN tipos_documento t ON t.id = m.tipo_id ORDER BY m.perfil, m.dia_criacao, t.ordem`);
}

/** Último dia do mês: dia 31 em fevereiro vira 28/29. */
function diaNoMes(ano: number, mes: number, dia: number): number {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return Math.min(dia, ultimo);
}

/** Datas que um modelo gera num dia: competência e prazo. */
export function datasDoModelo(m: { dia_prazo: number; dia_criacao: number; meses_competencia: number }, hoje: string): { competencia: string; prazo: string } {
  const [a, mm] = hoje.split('-').map(Number);
  const competencia = somarMeses(`${a}-${String(mm).padStart(2, '0')}-01`, m.meses_competencia);
  const mesPrazo = m.dia_prazo >= m.dia_criacao ? `${a}-${String(mm).padStart(2, '0')}-01` : somarMeses(`${a}-${String(mm).padStart(2, '0')}-01`, 1);
  const [pa, pm] = mesPrazo.split('-').map(Number);
  return { competencia, prazo: `${pa}-${String(pm).padStart(2, '0')}-${String(diaNoMes(pa, pm, m.dia_prazo)).padStart(2, '0')}` };
}

/** Empresas a que o modelo se aplica hoje (perfil, folha e o ajuste por empresa). */
async function empresasDoModelo(m: Modelo, diaHoje: number, ano: number, mes: number): Promise<{ id: string }[]> {
  const linhas = await todos<{ id: string; dia_criacao: number }>(
    `SELECT e.id, coalesce(a.dia_criacao, $2) AS dia_criacao FROM empresas e
     LEFT JOIN agenda_empresa a ON a.empresa_id = e.id AND a.modelo_id = $1
     WHERE e.ativo AND coalesce(a.ativo, true)
       AND (e.piloto OR NOT EXISTS (SELECT 1 FROM empresas p WHERE p.piloto))  -- modo piloto: só as empresas do piloto
       AND (CASE WHEN $3 = 'folha' THEN e.tem_folha ELSE e.perfil = $3 END)`, [m.id, m.dia_criacao, m.perfil]);
  return linhas.filter((l) => diaNoMes(ano, mes, l.dia_criacao) === diaHoje);
}

export async function rodarAgenda(instante: Date = new Date()): Promise<{ dia: string; pedidos: number; itens: number; jaExistiam: number }> {
  const hoje = dataDe(instante);
  const { ano, mes, dia } = partesSP(instante);
  await q(`INSERT INTO execucoes_job (nome, dia) VALUES ('agenda', $1) ON CONFLICT (nome, dia) DO UPDATE SET iniciado_em = now()`, [hoje]);
  let pedidos = 0, itens = 0, jaExistiam = 0;
  for (const m of (await listarModelos()).filter((x) => x.ativo)) {
    const empresas = await empresasDoModelo(m, dia, ano, mes);
    if (!empresas.length) continue;
    // Ajuste de prazo por empresa: agrupa as empresas pelo dia de prazo efetivo.
    const grupos = new Map<number, string[]>();
    for (const e of empresas) {
      const aj = await um<{ dia_prazo: number | null }>(`SELECT dia_prazo FROM agenda_empresa WHERE empresa_id = $1 AND modelo_id = $2`, [e.id, m.id]);
      const dp = aj?.dia_prazo ?? m.dia_prazo;
      grupos.set(dp, [...(grupos.get(dp) ?? []), e.id]);
    }
    for (const [diaPrazo, ids] of grupos) {
      const { competencia, prazo } = datasDoModelo({ ...m, dia_prazo: diaPrazo }, hoje);
      const r = await transacao((c) => criarPedido({ empresaIds: ids, tipoId: m.tipo_id, subtipos: 'todos', competencia, prazo, mensagem: m.mensagem, origem: 'agenda', modeloId: m.id }, c));
      if (r.itensCriados.length) { pedidos++; await aoCriarItens(r.itensCriados); }
      else await q(`DELETE FROM pedidos WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM itens_pedido WHERE pedido_id = $1)`, [r.pedidoId]);
      itens += r.itensCriados.length;
      jaExistiam += r.jaExistiam;
    }
  }
  const resumo = { dia: hoje, pedidos, itens, jaExistiam };
  await q(`UPDATE execucoes_job SET terminado_em = now(), resumo = $2 WHERE nome = 'agenda' AND dia = $1`, [hoje, JSON.stringify(resumo)]);
  return resumo;
}
function dataDe(instante: Date): string {
  const { ano, mes, dia } = partesSP(instante);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
