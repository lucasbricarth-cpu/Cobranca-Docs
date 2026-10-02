import Link from 'next/link';
import { AlertTriangle, CalendarClock, ClipboardCheck, HelpCircle } from 'lucide-react';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { pendencias, entregaDoMes, contadoresDoFuncionario } from '@/lib/consultas/inicio';
import { funcionariosAtivos } from '@/lib/consultas/empresas';
import { competenciaPadrao, dataCurta, nomeDoMes } from '@/lib/tempo';
import { Progresso } from '@/components/ui/Progresso';
import { uuidOuNada } from '@/lib/url';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Início' };

/** Início do funcionário: no topo, o que pede ação; depois a entrega do mês na carteira, com filtro por responsável. */
export default async function Inicio({ searchParams }: { searchParams: { resp?: string } }) {
  const s = await exigirFuncionario();
  // Funcionário abre nas empresas dele; Admin, na carteira toda. "todos" mostra tudo.
  const resp = searchParams.resp === 'todos' ? null : uuidOuNada(searchParams.resp) ?? (s.papel === 'admin' ? null : s.id);
  const competencia = competenciaPadrao();
  const [atrasados, semana, contadores, entrega, funcionarios] = await Promise.all([
    pendencias('atrasados', resp), pendencias('semana', resp), contadoresDoFuncionario(s), entregaDoMes(competencia, resp), funcionariosAtivos(),
  ]);
  const pct = entrega.total ? Math.round((entrega.conferidos / entrega.total) * 100) : 0;
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(new Date());
  const saudacao = Number(hora) < 12 ? 'Bom dia' : Number(hora) < 18 ? 'Boa tarde' : 'Boa noite';

  const Bloco = ({ titulo, Icone, total, itens, href, tom }: { titulo: string; Icone: typeof AlertTriangle; total: number; itens: { item_id: string; empresa_id: string; empresa: string; titulo: string; prazo: string }[]; href?: string; tom: string }) => (
    <section className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`icone-id ${tom}`}><Icone /></span>
        <span className="h2 flex-1">{titulo}</span>
        <span className="stat-val" style={{ fontSize: 26 }}>{total}</span>
      </div>
      {itens.length > 0 ? (
        <div className="lista">
          {itens.map((i) => (
            <Link key={i.item_id} href={`/clientes/${i.empresa_id}`} className="linha" style={{ minHeight: 48, padding: '8px 12px' }}>
              <span className="flex-1 min-w-0"><div className="linha-titulo truncate text-[13px]">{i.empresa}</div><div className="linha-sub truncate">{i.titulo}</div></span>
              <span className="mono text-[11.5px] text-fg-3">{dataCurta(i.prazo)}</span>
            </Link>
          ))}
          {total > itens.length && href && <Link href={href} className="text-[12.5px] texto-destaque self-start">Ver todos ({total})</Link>}
        </div>
      ) : <div className="text-[13px] text-fg-3">Nada aqui. 🎉</div>}
    </section>
  );

  return (
    <div className="max-w-[1100px] flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina">{saudacao}, {s.nome.split(' ')[0]}</h1>
        <p className="text-[13.5px] text-fg-3 mt-1">O que pede ação {resp ? (resp === s.id ? 'nas suas empresas' : 'nas empresas filtradas') : 'na carteira'}.</p>
      </div>
      <div className="chips">
        <Link href="/inicio?resp=todos" className={`chip ${resp === null ? 'active' : ''}`}>Carteira toda</Link>
        {funcionarios.map((f) => <Link key={f.id} href={`/inicio?resp=${f.id}`} className={`chip ${resp === f.id ? 'active' : ''}`}>{f.id === s.id ? 'Minhas' : f.nome.split(' ')[0]}</Link>)}
      </div>
      <div className="rg rg-3">
        <Bloco titulo="Atrasados" Icone={AlertTriangle} total={atrasados.total} itens={atrasados.itens} tom="neutro" />
        <Bloco titulo="Vencem nesta semana" Icone={CalendarClock} total={semana.total} itens={semana.itens} tom="neutro" />
        <section className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2"><span className="icone-id"><ClipboardCheck /></span><span className="h2 flex-1">Fila de trabalho</span></div>
          <Link href="/conferir" className="linha"><span className="flex-1"><div className="linha-titulo">A conferir</div><div className="linha-sub">Arquivos com sugestão de tipo</div></span><span className="stat-val" style={{ fontSize: 24 }}>{contadores.conferir}</span></Link>
          <Link href="/conferir?aba=nao" className="linha"><HelpCircle size={16} className="text-fg-3" aria-hidden /><span className="flex-1"><div className="linha-titulo">Não reconhecidos</div><div className="linha-sub">Sem tipo identificado, ou sem empresa</div></span><span className="stat-val" style={{ fontSize: 24 }}>{contadores.naoReconhecidos}</span></Link>
        </section>
      </div>
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1">
            <div className="eyebrow">Entrega de {nomeDoMes(competencia)}</div>
            <div className="flex items-baseline gap-2 mt-1"><span className="stat-val" style={{ fontSize: 40 }}>{pct}%</span><span className="text-[13px] text-fg-3">conferido</span></div>
          </div>
          <span className="text-[12.5px] text-fg-3"><b className="mono">{entrega.total}</b> itens pedidos</span>
        </div>
        <Progresso recebidos={entrega.recebidos} conferidos={entrega.conferidos} total={entrega.total} />
        {entrega.porResponsavel.length > 1 && (
          <div className="flex flex-col gap-2.5 mt-1">
            {entrega.porResponsavel.map((r) => (
              <div key={r.responsavel_id ?? 'sem'} className="grid gap-3 items-center" style={{ gridTemplateColumns: 'minmax(90px, 160px) 1fr auto' }}>
                <span className="text-[13px] truncate">{r.responsavel ?? 'Sem responsável'}</span>
                <Progresso recebidos={r.recebidos} conferidos={r.conferidos} total={r.total} compacta />
                <span className="mono text-[12px] text-fg-3">{r.conferidos}/{r.total}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
