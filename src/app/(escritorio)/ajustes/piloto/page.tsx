import { exigirAdmin } from '@/lib/auth/sessao';
import { empresasDoPiloto, metricas, volumeWhatsApp } from '@/lib/piloto';
import { todos } from '@/lib/db';
import { dataSP, somarDias, dataCurta } from '@/lib/tempo';
import { EmpresasPiloto } from './EmpresasPiloto';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Piloto e métricas' };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
function horas(h: number | null) {
  if (h === null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
}
const dataOk = (s?: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') ? s! : null);

/** Etapa 10: o piloto e as métricas para decidir quando ampliar. */
export default async function PaginaPiloto({ searchParams }: { searchParams: { desde?: string; ate?: string; todas?: string } }) {
  await exigirAdmin();
  const hoje = dataSP();
  const ate = dataOk(searchParams.ate) ?? hoje;
  const desde = dataOk(searchParams.desde) ?? somarDias(ate, -29);
  const piloto = await empresasDoPiloto();
  const soPiloto = piloto.length > 0 && searchParams.todas !== '1';
  const [linhas, whats, empresas] = await Promise.all([
    metricas({ desde, ate, soPiloto }), volumeWhatsApp(14),
    todos<{ id: string; nome: string; responsavel: string | null }>(`SELECT e.id, e.nome, u.nome AS responsavel FROM empresas e LEFT JOIN usuarios u ON u.id = e.responsavel_id WHERE e.ativo AND NOT e.piloto ORDER BY e.nome`),
  ]);
  const limite = Number(process.env.WHATSAPP_LIMITE_DIARIO ?? 50);
  const maxW = Math.max(limite, ...whats.map((w) => w.enviados), 1);
  const tot = linhas.reduce((a, l) => ({ itens: a.itens + l.itens, enviados: a.enviados + l.enviados, no_prazo: a.no_prazo + l.no_prazo, rejeitados: a.rejeitados + l.rejeitados, ia: a.ia + l.ia_total, iaOk: a.iaOk + l.ia_acertos_tipo }),
    { itens: 0, enviados: 0, no_prazo: 0, rejeitados: 0, ia: 0, iaOk: 0 });
  const comDados = linhas.filter((l) => l.itens || l.ia_total);

  return (
    <div className="max-w-[1040px] flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina mb-1">Piloto e métricas</h1>
        <p className="text-[13px] text-fg-3">Comece com poucas empresas, de responsáveis diferentes, durante um mês <span className="pill pill-warn">[DECIDIR]</span>. Amplie para a carteira inteira só depois de olhar estes números.</p>
      </div>

      <EmpresasPiloto piloto={piloto.map((p) => ({ id: p.id, nome: p.nome, responsavel: p.responsavel, responsavelId: p.responsavel_id }))} candidatas={empresas} />

      <form method="get" className="card p-3 flex gap-2 flex-wrap items-end">
        <div className="campo"><label className="label" htmlFor="pl-desde">De</label><input id="pl-desde" name="desde" type="date" className="input" defaultValue={desde} /></div>
        <div className="campo"><label className="label" htmlFor="pl-ate">Até</label><input id="pl-ate" name="ate" type="date" className="input" defaultValue={ate} /></div>
        {piloto.length > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-fg-3 h-[38px]"><input type="checkbox" className="selecao" name="todas" value="1" defaultChecked={!soPiloto} />Carteira inteira</label>
        )}
        <button className="btn" type="submit">Atualizar</button>
        <span className="flex-1" />
        <span className="text-[12px] text-fg-4 self-center">{soPiloto ? `Só as ${piloto.length} empresas do piloto` : 'Carteira inteira'} · pedidos criados de {dataCurta(desde, true)} a {dataCurta(ate, true)}</span>
      </form>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          ['Itens pedidos', String(tot.itens), `${tot.enviados} enviados`],
          ['Enviados no prazo', pct(tot.no_prazo, tot.enviados), `${tot.no_prazo} de ${tot.enviados}`],
          ['Rejeitados', pct(tot.rejeitados, tot.itens), tot.rejeitados === 1 ? '1 item pedido de novo' : `${tot.rejeitados} itens pedidos de novo`],
          ['Acerto da IA (tipo)', pct(tot.iaOk, tot.ia), `${tot.ia} conferências`],
        ].map(([rotulo, valor, sub]) => (
          <div key={rotulo} className="card p-4">
            <div className="eyebrow">{rotulo}</div>
            <div className="stat-val mt-1">{valor}</div>
            <div className="text-[12px] text-fg-3 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <section className="card p-0 overflow-x-auto">
        <table className="tabela">
          <thead><tr><th>Tipo</th><th>Pedidos</th><th>Enviados</th><th title="Do pedido ao primeiro arquivo">Até o envio<br /><span className="text-fg-4">mediana · 90%</span></th><th>No prazo</th><th>Atrasados</th><th>Rejeitados</th><th>WhatsApp</th><th>Acerto da IA<br /><span className="text-fg-4">tipo · subtipo</span></th></tr></thead>
          <tbody>
            {comDados.length ? comDados.map((l) => (
              <tr key={l.tipo_id}>
                <td>{l.tipo}{l.sensivel && <span className="text-fg-4"> · sensível</span>}</td>
                <td className="mono">{l.itens}</td>
                <td className="mono">{l.enviados}</td>
                <td className="mono">{horas(l.mediana_h)} · {horas(l.p90_h)}</td>
                <td className="mono">{pct(l.no_prazo, l.enviados)}</td>
                <td className="mono">{l.atrasados_abertos || '—'}</td>
                <td className="mono">{l.rejeitados ? `${l.rejeitados} (${pct(l.rejeitados, l.itens)})` : '—'}</td>
                <td className="mono">{pct(l.pelo_whatsapp, l.enviados)}</td>
                <td className="mono">{l.sensivel ? <span className="text-fg-4">sem IA</span> : l.ia_total ? <>{pct(l.ia_acertos_tipo, l.ia_total)} · {pct(l.ia_acertos_subtipo, l.ia_com_subtipo)}</> : '—'}</td>
              </tr>
            )) : <tr><td colSpan={9} className="text-center text-fg-3 py-6">Sem pedidos nem conferências no período.</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="text-[12px] text-fg-3 -mt-2">O arquivamento automático (Ajustes › Classificação) só deve ser ligado num tipo com acerto alto e estável no piloto. Sensíveis nunca passam pela IA.</p>

      <section className="card p-4 flex flex-col gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="font-semibold">WhatsApp: mensagens automáticas por dia</div>
          <span className="text-[12px] text-fg-3">limite atual <b className="mono texto-destaque">{limite}</b>/dia (WHATSAPP_LIMITE_DIARIO)</span>
        </div>
        <div className="grafico-barras" role="img" aria-label="Mensagens de WhatsApp por dia nos últimos 14 dias">
          {whats.map((w) => (
            <div key={w.dia} className="grafico-coluna" title={`${dataCurta(w.dia)}: ${w.enviados}`}>
              <div className="grafico-barra" style={{ height: `${Math.max(2, (w.enviados / maxW) * 100)}%` }} />
              <div className="grafico-rotulo mono">{w.dia.slice(8)}</div>
            </div>
          ))}
          <div className="grafico-limite" style={{ bottom: `calc(18px + ${(limite / maxW).toFixed(4)} * (100% - 18px))` }} />
        </div>
        <p className="text-[12.5px] text-fg-3">O número é o do atendimento inteiro. Suba o limite aos poucos e só com a nota de qualidade do número em verde, no painel da Meta (ou da plataforma). Ao primeiro amarelo, pare e revise os textos. Veja docs/whatsapp.md.</p>
      </section>
    </div>
  );
}
