import { exigirCliente } from '@/lib/auth/sessao';
import { todos } from '@/lib/db';
import { nomeGerado } from '@/lib/documentos/nomes';
import { nomeDoMes } from '@/lib/tempo';
import { ListaEnviados } from './ListaEnviados';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enviados' };

/** O que este login enviou (app ou WhatsApp), por mês. "Enviado" e "Conferido pelo escritório" são estados diferentes. */
export default async function Enviados() {
  const s = await exigirCliente();
  const linhas = await todos<Record<string, unknown>>(
    `SELECT d.id, d.nome_original, d.status, to_char(d.competencia, 'YYYY-MM-DD') AS competencia, d.recebido_em, d.origem, d.empresa_id, e.nome AS empresa,
            t.nome AS tipo_nome, s.nome AS sub_nome, s.cartao_final, s.cartao_emissor, cb.codigo_banco, cb.nome_banco, cb.final AS conta_final, d.motivo_rejeicao
     FROM documentos d LEFT JOIN empresas e ON e.id = d.empresa_id LEFT JOIN tipos_documento t ON t.id = d.tipo_id
     LEFT JOIN subtipos s ON s.id = d.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     WHERE d.enviado_por_login = $1 AND d.excluido_em IS NULL AND d.status <> 'recusado' AND d.empresa_id = ANY($2)
     ORDER BY d.recebido_em DESC LIMIT 300`, [s.id, s.empresas.map((e) => e.id)]);
  const itens = linhas.map((r) => ({
    id: r.id as string, empresaId: r.empresa_id as string, empresa: r.empresa as string, status: r.status as string, origem: r.origem as string,
    recebido_em: (r.recebido_em as Date).toISOString(), motivo: r.motivo_rejeicao as string | null,
    mes: r.competencia ? nomeDoMes(r.competencia as string) : 'Sem mês',
    nome: nomeGerado({ tipo_nome: r.tipo_nome as string | null, competencia: r.competencia as string | null, nome_original: r.nome_original as string,
      subtipo: { nome: r.sub_nome as string, cartao_final: r.cartao_final as string, cartao_emissor: r.cartao_emissor as string, codigo_banco: r.codigo_banco as string, nome_banco: r.nome_banco as string, conta_final: r.conta_final as string } }),
  }));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="titulo-pagina">Enviados</h1>
      <ListaEnviados itens={itens} empresas={s.empresas.map((e) => ({ id: e.id, nome: e.nome }))} />
    </div>
  );
}
