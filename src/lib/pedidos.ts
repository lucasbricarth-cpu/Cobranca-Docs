import type { PoolClient } from 'pg';
import { transacao, todos, um } from '@/lib/db';
import { ErroApi } from '@/lib/api';

/**
 * Pedidos e itens. A restrição única (empresa, tipo, subtipo, competência)
 * garante um item só por chave: pedir de novo o que já foi pedido não
 * duplica, e é o que permite "2 de 3 extratos recebidos" e lembrar só do
 * que falta.
 */
export interface NovoPedido {
  empresaIds: string[];
  tipoId: string;
  /** Subtipos escolhidos (uma empresa), ou 'todos' = todas as contas/cartões/subtipos ativos de cada empresa. */
  subtipos: string[] | 'todos';
  competencia: string;   // AAAA-MM-01
  prazo: string | null;  // AAAA-MM-DD
  mensagem?: string | null;
  origem: 'avulso' | 'agenda';
  modeloId?: string | null;
  criadoPor?: string | null;
}
export interface ResultadoPedido { pedidoId: string; itensCriados: string[]; jaExistiam: number; empresasSemSubtipo: string[] }

export async function criarPedido(p: NovoPedido, cliente?: PoolClient): Promise<ResultadoPedido> {
  if (!/^\d{4}-\d{2}-01$/.test(p.competencia)) throw new ErroApi('Competência inválida.');
  if (p.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(p.prazo)) throw new ErroApi('Prazo inválido.');
  if (!p.empresaIds.length) throw new ErroApi('Escolha ao menos uma empresa.');
  if (Array.isArray(p.subtipos) && p.subtipos.length && p.empresaIds.length > 1) throw new ErroApi('Subtipos específicos só valem para uma empresa. Para várias, use "Todas as contas".');
  const executar = async (c: PoolClient): Promise<ResultadoPedido> => {
    const tipo = (await c.query<{ subtipo_origem: string | null; ativo: boolean }>(`SELECT subtipo_origem, ativo FROM tipos_documento WHERE id = $1`, [p.tipoId])).rows[0];
    if (!tipo?.ativo) throw new ErroApi('Tipo inválido ou inativo.');
    const pedido = (await c.query<{ id: string }>(
      `INSERT INTO pedidos (origem, modelo_id, mensagem, criado_por, tipo_id, competencia, prazo, todas_as_contas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [p.origem, p.modeloId ?? null, p.mensagem?.trim() || null, p.criadoPor ?? null, p.tipoId, p.competencia, p.prazo, p.subtipos === 'todos'])).rows[0];
    const criados: string[] = [];
    let jaExistiam = 0;
    const semSubtipo: string[] = [];
    for (const empresaId of p.empresaIds) {
      // Quais subtipos: os escolhidos, ou todos os ATIVOS (conta que o funcionário parou de pedir fica de fora).
      let alvos: (string | null)[];
      if (!tipo.subtipo_origem) alvos = [null];
      else if (p.subtipos === 'todos') {
        alvos = (await c.query<{ id: string }>(`SELECT id FROM subtipos WHERE empresa_id = $1 AND tipo_id = $2 AND ativo ORDER BY criado_em`, [empresaId, p.tipoId])).rows.map((r) => r.id);
        if (!alvos.length) {
          if (tipo.subtipo_origem === 'livre') alvos = [null];
          else { semSubtipo.push(empresaId); continue; }
        }
      } else {
        const validos = (await c.query<{ id: string }>(`SELECT id FROM subtipos WHERE id = ANY($1) AND empresa_id = $2 AND tipo_id = $3`, [p.subtipos, empresaId, p.tipoId])).rows.map((r) => r.id);
        if (validos.length !== p.subtipos.length) throw new ErroApi('Subtipo inválido para esta empresa.');
        alvos = validos.length ? validos : [null];
      }
      for (const subtipoId of alvos) {
        const r = await c.query<{ id: string; novo: boolean }>(
          `INSERT INTO itens_pedido (pedido_id, empresa_id, tipo_id, subtipo_id, competencia, prazo, mensagem)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT ON CONSTRAINT um_item_por_competencia DO UPDATE
             SET status = CASE WHEN itens_pedido.status = 'cancelado' THEN 'pendente' ELSE itens_pedido.status END,
                 prazo = CASE WHEN itens_pedido.status = 'cancelado' THEN EXCLUDED.prazo ELSE itens_pedido.prazo END,
                 pedido_id = CASE WHEN itens_pedido.status = 'cancelado' THEN EXCLUDED.pedido_id ELSE itens_pedido.pedido_id END
           RETURNING id, (xmax = 0) AS novo`,
          [pedido.id, empresaId, p.tipoId, subtipoId, p.competencia, p.prazo, p.mensagem?.trim() || null]);
        if (r.rows[0].novo) criados.push(r.rows[0].id); else jaExistiam++;
      }
    }
    return { pedidoId: pedido.id, itensCriados: criados, jaExistiam, empresasSemSubtipo: semSubtipo };
  };
  return cliente ? executar(cliente) : transacao(executar);
}

export async function cancelarItem(itemId: string) {
  const r = await um<{ status: string }>(`SELECT status FROM itens_pedido WHERE id = $1`, [itemId]);
  if (!r) throw new ErroApi('Item não encontrado.', 404);
  if (r.status === 'conferido') throw new ErroApi('Item já conferido não pode ser cancelado.');
  await um(`UPDATE itens_pedido SET status = 'cancelado' WHERE id = $1`, [itemId]);
}

export interface LinhaPedido {
  id: string; origem: string; criado_em: Date; tipo_nome: string; competencia: string; prazo: string | null; mensagem: string | null;
  criado_por: string | null; empresas: number; total: number; recebidos: number; conferidos: number; atrasados: number;
}
export async function listarPedidos(limite = 50): Promise<LinhaPedido[]> {
  return todos<LinhaPedido>(
    `SELECT p.id, p.origem, p.criado_em, t.nome AS tipo_nome, to_char(p.competencia, 'YYYY-MM-DD') AS competencia, to_char(p.prazo, 'YYYY-MM-DD') AS prazo,
            p.mensagem, u.nome AS criado_por,
            count(DISTINCT i.empresa_id)::int AS empresas, count(i.id)::int AS total,
            count(i.id) FILTER (WHERE i.status IN ('recebido', 'conferido'))::int AS recebidos,
            count(i.id) FILTER (WHERE i.status = 'conferido')::int AS conferidos,
            count(i.id) FILTER (WHERE i.status IN ('pendente', 'refazer') AND i.prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int AS atrasados
     FROM pedidos p JOIN tipos_documento t ON t.id = p.tipo_id
     LEFT JOIN usuarios u ON u.id = p.criado_por
     LEFT JOIN itens_pedido i ON i.pedido_id = p.id AND i.status <> 'cancelado'
     GROUP BY p.id, t.nome, u.nome ORDER BY p.criado_em DESC LIMIT $1`, [limite]);
}
