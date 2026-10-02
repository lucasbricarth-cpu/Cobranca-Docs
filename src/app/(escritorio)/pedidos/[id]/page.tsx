import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { todos, um } from '@/lib/db';
import { uuidOuNada } from '@/lib/url';
import { dataCurta, mesCurto, hojeSP } from '@/lib/tempo';
import { nomeDoSubtipo } from '@/lib/documentos/nomes';
import { statusDaTela } from '@/lib/documentos/consultas';
import { Pilula } from '@/components/ui/Pilula';
import { Progresso } from '@/components/ui/Progresso';
import { AcoesItem } from './AcoesItem';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedido' };

export default async function Pedido({ params }: { params: { id: string } }) {
  await exigirFuncionario();
  if (!uuidOuNada(params.id)) notFound();
  const p = await um<{ id: string; origem: string; tipo_nome: string; competencia: string; prazo: string | null; mensagem: string | null; criado_em: Date; criado_por: string | null }>(
    `SELECT p.id, p.origem, t.nome AS tipo_nome, to_char(p.competencia, 'YYYY-MM-DD') AS competencia, to_char(p.prazo, 'YYYY-MM-DD') AS prazo, p.mensagem, p.criado_em, u.nome AS criado_por
     FROM pedidos p JOIN tipos_documento t ON t.id = p.tipo_id LEFT JOIN usuarios u ON u.id = p.criado_por WHERE p.id = $1`, [params.id]);
  if (!p) notFound();
  const itens = await todos<Record<string, unknown>>(
    `SELECT i.id, i.status, to_char(i.prazo, 'YYYY-MM-DD') AS prazo, e.id AS empresa_id, e.nome AS empresa, e.telefone_e164,
            s.nome AS sub_nome, s.cartao_final, s.cartao_emissor, cb.codigo_banco, cb.nome_banco, cb.final AS conta_final
     FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id
     LEFT JOIN subtipos s ON s.id = i.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     WHERE i.pedido_id = $1 ORDER BY e.nome, cb.codigo_banco NULLS LAST`, [params.id]);
  const hoje = hojeSP();
  const vivos = itens.filter((i) => i.status !== 'cancelado');
  const recebidos = vivos.filter((i) => i.status === 'recebido' || i.status === 'conferido').length;
  const conferidos = vivos.filter((i) => i.status === 'conferido').length;
  return (
    <div className="max-w-[860px] flex flex-col gap-4">
      <Link href="/pedidos" className="btn btn-ghost btn-sm self-start -ml-2"><ChevronLeft size={14} />Pedidos</Link>
      <div>
        <h1 className="titulo-pagina">{p.tipo_nome} · {mesCurto(p.competencia)}</h1>
        <p className="text-[13px] text-fg-3 mt-1">{p.origem === 'agenda' ? 'Criado pela agenda' : `Avulso${p.criado_por ? ` por ${p.criado_por}` : ''}`} em {dataCurta(p.criado_em, true)}{p.prazo ? ` · prazo ${dataCurta(p.prazo, true)}` : ''}</p>
        {p.mensagem && <p className="card p-3 mt-3 text-[13.5px]">{p.mensagem}</p>}
      </div>
      <div className="card p-4"><Progresso recebidos={recebidos} conferidos={conferidos} total={vivos.length} /></div>
      <div className="lista">
        {itens.map((i) => {
          const sub = nomeDoSubtipo({ nome: i.sub_nome as string, cartao_final: i.cartao_final as string, cartao_emissor: i.cartao_emissor as string, codigo_banco: i.codigo_banco as string, nome_banco: i.nome_banco as string, conta_final: i.conta_final as string });
          return (
            <div key={i.id as string} className="linha flex-wrap">
              <span className="flex-1 min-w-[200px]">
                <Link href={`/clientes/${i.empresa_id}?mes=${p.competencia}`} className="linha-titulo hover:underline">{i.empresa as string}</Link>
                <div className="linha-sub">{sub || p.tipo_nome}{i.prazo ? ` · prazo ${dataCurta(i.prazo as string)}` : ''}</div>
              </span>
              {i.status === 'cancelado' ? <span className="pill">Cancelado</span> : <Pilula status={statusDaTela(i.status as string, i.prazo as string | null, hoje)} />}
              <AcoesItem itemId={i.id as string} empresaId={i.empresa_id as string} podeCancelar={!['conferido', 'cancelado'].includes(i.status as string)} aberto={['pendente', 'refazer'].includes(i.status as string)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
