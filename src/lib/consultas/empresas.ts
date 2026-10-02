import { todos, um } from '@/lib/db';
import { normalizarBusca } from '@/lib/texto';

export interface LinhaEmpresa {
  id: string; nome: string; cnpj: string; responsavel: string | null; responsavel_id: string | null;
  ativo: boolean; total: number; recebidos: number; conferidos: number; atrasados: number;
}

/** Lista de clientes com o andamento do mês (os números entram a partir da Etapa 4). */
export async function listarEmpresas(f: { busca?: string; responsavelId?: string; competencia: string }): Promise<LinhaEmpresa[]> {
  const busca = f.busca ? `%${normalizarBusca(f.busca)}%` : null;
  const digitos = f.busca ? f.busca.replace(/\D/g, '') : '';
  const temItens = await um<{ t: string | null }>(`SELECT to_regclass('public.itens_pedido') AS t`);
  const andamento = temItens?.t
    ? `(SELECT count(*) FROM itens_pedido i WHERE i.empresa_id = e.id AND i.competencia = $3 AND i.status <> 'cancelado')::int AS total,
       (SELECT count(*) FROM itens_pedido i WHERE i.empresa_id = e.id AND i.competencia = $3 AND i.status IN ('recebido','conferido'))::int AS recebidos,
       (SELECT count(*) FROM itens_pedido i WHERE i.empresa_id = e.id AND i.competencia = $3 AND i.status = 'conferido')::int AS conferidos,
       (SELECT count(*) FROM itens_pedido i WHERE i.empresa_id = e.id AND i.status IN ('pendente','refazer') AND i.prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int AS atrasados`
    : `0 AS total, 0 AS recebidos, 0 AS conferidos, 0 AS atrasados, $3::date AS _c`;
  return todos<LinhaEmpresa>(
    `SELECT e.id, e.nome, e.cnpj, u.nome AS responsavel, e.responsavel_id, e.ativo, ${andamento}
     FROM empresas e LEFT JOIN usuarios u ON u.id = e.responsavel_id
     WHERE ($1::text IS NULL OR translate(lower(e.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE $1 OR ($4 <> '' AND e.cnpj LIKE '%' || $4 || '%'))
       AND ($2::uuid IS NULL OR e.responsavel_id = $2)
     ORDER BY e.ativo DESC, e.nome`,
    [busca, f.responsavelId ?? null, f.competencia, digitos]);
}

export async function dadosDaEmpresa(id: string) {
  return um<{ id: string; nome: string; cnpj: string; email: string | null; responsavel: string | null; responsavel_id: string | null; perfil: string; tem_folha: boolean; ativo: boolean; codi_emp: number | null; telefone_e164: string | null }>(
    `SELECT e.id, e.nome, e.cnpj, e.email, u.nome AS responsavel, e.responsavel_id, e.perfil, e.tem_folha, e.ativo, e.codi_emp, e.telefone_e164
     FROM empresas e LEFT JOIN usuarios u ON u.id = e.responsavel_id WHERE e.id = $1`, [id]);
}

export async function funcionariosAtivos() {
  return todos<{ id: string; nome: string }>(`SELECT id, nome FROM usuarios WHERE ativo ORDER BY nome`);
}
