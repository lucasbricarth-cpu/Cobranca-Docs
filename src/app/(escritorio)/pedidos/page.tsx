import Link from 'next/link';
import { Plus, CalendarDays } from 'lucide-react';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { listarPedidos } from '@/lib/pedidos';
import { dataCurta, mesCurto } from '@/lib/tempo';
import { Progresso } from '@/components/ui/Progresso';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedidos' };

export default async function Pedidos() {
  await exigirFuncionario();
  const pedidos = await listarPedidos(80);
  return (
    <div className="max-w-[900px]">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <h1 className="titulo-pagina">Pedidos</h1>
        <div className="flex gap-2"><Link href="/agenda" className="btn"><CalendarDays size={15} />Agenda</Link><Link href="/pedidos/novo" className="btn btn-primary"><Plus size={15} />Novo pedido</Link></div>
      </div>
      <div className="lista">
        {pedidos.length === 0 && <div className="vazio">Nenhum pedido ainda. Crie um avulso ou deixe a agenda criar todo mês.</div>}
        {pedidos.map((p) => (
          <Link key={p.id} href={`/pedidos/${p.id}`} className="linha flex-wrap">
            <span className="flex-1 min-w-[220px]">
              <div className="linha-titulo">{p.tipo_nome} · {mesCurto(p.competencia)}</div>
              <div className="linha-sub">{p.origem === 'agenda' ? 'Agenda' : `Avulso${p.criado_por ? ` por ${p.criado_por}` : ''}`} · {dataCurta(p.criado_em)} · {p.empresas} empresa{p.empresas === 1 ? '' : 's'}{p.prazo ? ` · prazo ${dataCurta(p.prazo)}` : ''}</div>
              <div className="mt-2 max-w-[360px]"><Progresso recebidos={p.recebidos} conferidos={p.conferidos} total={p.total} compacta /></div>
            </span>
            <span className="mono text-[12px] text-fg-3">{p.conferidos}/{p.total}</span>
            {p.atrasados > 0 && <span className="pill st-atrasado">{p.atrasados} atrasado{p.atrasados > 1 ? 's' : ''}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
