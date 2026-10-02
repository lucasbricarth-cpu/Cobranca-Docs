import Link from 'next/link';
import { Lock, AlertTriangle } from 'lucide-react';
import { exigirCliente } from '@/lib/auth/sessao';
import { checklistDoCliente } from '@/lib/consultas/cliente';
import { nomeDoMes, mesCurto, dataCurta } from '@/lib/tempo';
import { Pilula } from '@/components/ui/Pilula';
import { BotoesEnvio } from '@/components/envio/BotoesEnvio';
import { EnviosGuardados } from '@/components/envio/EnviosGuardados';
import type { ItemDoMes } from '@/lib/documentos/consultas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pendentes' };

/** O status do ponto de vista do cliente: "Enviado" e "Conferido pelo escritório" são estados diferentes. */
const TEXTO: Record<string, string> = { pendente: 'Pendente', atrasado: 'Atrasado', recebido: 'Enviado', conferido: 'Conferido pelo escritório', refazer: 'Refazer' };

export default async function Pendentes({ searchParams }: { searchParams: { e?: string } }) {
  const s = await exigirCliente();
  const empresa = s.empresas.find((e) => e.id === searchParams.e) ?? s.empresas[0];
  if (!empresa) return <div className="vazio">Seu acesso ainda não tem empresa. Fale com o escritório.</div>;
  const { competencia, doMes, outros } = await checklistDoCliente(empresa.id);
  const enviados = doMes.filter((i) => i.status === 'recebido' || i.status === 'conferido').length;
  const refazer = [...doMes, ...outros].filter((i) => i.status === 'refazer');
  const empresas = s.empresas.map((e) => ({ id: e.id, nome: e.nome, cnpj: e.cnpj }));
  const paraEnvio = (i: ItemDoMes) => ({ id: i.id, titulo: i.titulo, empresaId: empresa.id, tipoId: i.tipo_id, subtipoId: i.subtipo_id, sensivel: i.sensivel });

  const Linha = ({ i, mes }: { i: ItemDoMes; mes?: string }) => (
    <div className={`linha flex-col items-stretch ${i.status === 'refazer' ? 'linha-refazer' : ''}`} data-item={i.id}>
      <div className="flex items-start gap-3">
        <span className="flex-1 min-w-0">
          <div className="linha-titulo flex items-center gap-1.5">{i.sensivel && <Lock size={13} aria-label="Sensível" />}{i.titulo}{mes ? <span className="text-fg-3 font-normal"> · {mesCurto(mes)}</span> : null}</div>
          <div className="linha-sub">
            {i.status === 'refazer' ? <b className="text-[var(--warn-text)]">{i.motivo_refazer ?? 'O escritório pediu para enviar de novo.'}</b>
              : i.status === 'recebido' || i.status === 'conferido' ? `Enviado em ${i.recebido_em ? dataCurta(i.recebido_em) : '—'}`
              : i.prazo ? `Prazo ${dataCurta(i.prazo)}` : 'Sem prazo'}
          </div>
        </span>
        <Pilula status={i.status} texto={TEXTO[i.status]} />
      </div>
      {(i.status === 'pendente' || i.status === 'atrasado' || i.status === 'refazer') && <BotoesEnvio item={paraEnvio(i)} empresas={empresas} />}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {s.empresas.length > 1 && (
        <div className="chips" role="tablist" aria-label="Empresa">
          {s.empresas.map((e) => <Link key={e.id} href={`/cliente?e=${e.id}`} className={`chip ${e.id === empresa.id ? 'active' : ''}`} role="tab" aria-selected={e.id === empresa.id}>{e.nome}</Link>)}
        </div>
      )}
      <div>
        <div className="eyebrow">{empresa.nome}</div>
        <h1 className="titulo-pagina mt-1">{nomeDoMes(competencia)}</h1>
      </div>
      <section className="card p-4 flex flex-col gap-3">
        <div className="flex items-baseline gap-2"><span className="stat-val">{enviados} de {doMes.length}</span><span className="text-[13px] text-fg-3">enviados</span></div>
        <div className="barra"><i className="b-conferidos" style={{ width: `${doMes.length ? (enviados / doMes.length) * 100 : 0}%` }} /></div>
        <BotoesEnvio item={null} empresas={empresas} escanear />
      </section>
      <EnviosGuardados />
      {refazer.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Precisa refazer">
          <div className="eyebrow flex items-center gap-1.5 text-[var(--warn-text)]"><AlertTriangle size={13} />Precisa refazer</div>
          <div className="lista">{refazer.map((i) => <Linha key={i.id} i={i} mes={'competencia' in i ? (i as { competencia: string }).competencia : undefined} />)}</div>
        </section>
      )}
      <section className="flex flex-col gap-2" aria-label="Pedidos do mês">
        <div className="eyebrow">Pedidos de {nomeDoMes(competencia)}</div>
        <div className="lista">
          {doMes.length === 0 && <div className="vazio">Nenhum pedido neste mês.</div>}
          {doMes.filter((i) => i.status !== 'refazer').map((i) => <Linha key={i.id} i={i} />)}
        </div>
      </section>
      {outros.filter((i) => i.status !== 'refazer').length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Outros meses">
          <div className="eyebrow">Ainda em aberto de outros meses</div>
          <div className="lista">{outros.filter((i) => i.status !== 'refazer').map((i) => <Linha key={i.id} i={i} mes={i.competencia} />)}</div>
        </section>
      )}
    </div>
  );
}
