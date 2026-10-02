import { todos, um } from '@/lib/db';
import { competenciaPelaRegra } from '@/lib/tempo';
import { ErroApi } from '@/lib/api';

/**
 * Regra do mês de referência (prompt, Etapa 5):
 * - COM pedido: é o mês do pedido, sem leitura;
 * - SEM pedido e UM único item aberto daquele tipo e subtipo: vai para esse item;
 * - SEM pedido e DOIS ou mais itens abertos: pergunta "Este documento é de qual mês?", nada marcado;
 * - SEM pedido e NENHUM item aberto: vale a regra do tipo, já preenchida e editável.
 * O mês nunca vem da IA. "Agora" conta no fuso de São Paulo.
 */
export type OpcoesMes =
  | { modo: 'pedido'; itemId: string; competencia: string }
  | { modo: 'item'; itemId: string; competencia: string }
  | { modo: 'escolher'; meses: { competencia: string; itemId: string }[] }
  | { modo: 'regra'; competencia: string };

export async function opcoesDeMes(a: { itemId?: string | null; empresaId: string; tipoId: string; subtipoId: string | null; agora?: Date }): Promise<OpcoesMes> {
  if (a.itemId) {
    const i = await um<{ competencia: string }>(`SELECT to_char(competencia, 'YYYY-MM-DD') AS competencia FROM itens_pedido WHERE id = $1`, [a.itemId]);
    if (!i) throw new ErroApi('Pedido não encontrado.', 404);
    return { modo: 'pedido', itemId: a.itemId, competencia: i.competencia };
  }
  const abertos = await todos<{ id: string; competencia: string }>(
    `SELECT id, to_char(competencia, 'YYYY-MM-DD') AS competencia FROM itens_pedido
     WHERE empresa_id = $1 AND tipo_id = $2 AND subtipo_id IS NOT DISTINCT FROM $3 AND status IN ('pendente', 'refazer')
     ORDER BY competencia`, [a.empresaId, a.tipoId, a.subtipoId]);
  if (abertos.length === 1) return { modo: 'item', itemId: abertos[0].id, competencia: abertos[0].competencia };
  if (abertos.length > 1) return { modo: 'escolher', meses: abertos.map((x) => ({ competencia: x.competencia, itemId: x.id })) };
  const t = await um<{ regra_mes: 'anterior' | 'atual' }>(`SELECT regra_mes FROM tipos_documento WHERE id = $1`, [a.tipoId]);
  return { modo: 'regra', competencia: competenciaPelaRegra(t?.regra_mes ?? 'anterior', a.agora ?? new Date()) };
}

/**
 * Valida o que o cliente escolheu contra as opções do servidor (nunca confia
 * no aparelho). Devolve o item a que o arquivo vai, se houver, e o mês.
 */
export async function resolverMes(a: { itemId?: string | null; empresaId: string; tipoId: string; subtipoId: string | null; competenciaEscolhida?: string | null; agora?: Date }): Promise<{ itemId: string | null; competencia: string }> {
  const o = await opcoesDeMes(a);
  if (o.modo === 'pedido' || o.modo === 'item') return { itemId: o.itemId, competencia: o.competencia };
  if (o.modo === 'escolher') {
    const m = o.meses.find((x) => x.competencia === a.competenciaEscolhida);
    if (!m) throw new ErroApi('Escolha de qual mês é o documento.');
    return { itemId: m.itemId, competencia: m.competencia };
  }
  // Regra do tipo: preenchida, mas o cliente pode editar (não pode ser no futuro).
  const c = a.competenciaEscolhida && /^\d{4}-\d{2}-01$/.test(a.competenciaEscolhida) ? a.competenciaEscolhida : o.competencia;
  const limite = competenciaPelaRegra('atual', a.agora ?? new Date());
  if (c > limite) throw new ErroApi('O mês não pode estar no futuro.');
  // Se o mês editado tiver item aberto, o arquivo vai para ele.
  const it = await um<{ id: string }>(
    `SELECT id FROM itens_pedido WHERE empresa_id = $1 AND tipo_id = $2 AND subtipo_id IS NOT DISTINCT FROM $3 AND competencia = $4 AND status IN ('pendente', 'refazer')`,
    [a.empresaId, a.tipoId, a.subtipoId, c]);
  return { itemId: it?.id ?? null, competencia: c };
}
