import { exigirAdmin } from '@/lib/auth/sessao';
import { todos } from '@/lib/db';
import { dataCurta, horaSP } from '@/lib/tempo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leitor da Domínio' };

export default async function LeitorDominio() {
  await exigirAdmin();
  const execs = await todos<{ iniciada_em: Date; empresas: number; contatos: number; contas: number; diagnostico: Record<string, unknown> | null; erro: string | null }>(
    `SELECT iniciada_em, empresas, contatos, contas, diagnostico, erro FROM leitor_execucoes ORDER BY iniciada_em DESC LIMIT 15`);
  const diag = execs.find((e) => e.diagnostico)?.diagnostico;
  const ultima = execs[0];
  const atrasado = !ultima || Date.now() - new Date(ultima.iniciada_em).getTime() > 36 * 3600 * 1000;
  return (
    <div className="max-w-[760px] flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina mb-1">Leitor da Domínio</h1>
        <p className="text-[13px] text-fg-3">Programa no servidor do escritório que lê a Domínio só com SELECT e envia para cá pelo menos uma vez por dia. Instalação em <span className="mono">leitor-dominio/README.md</span>.</p>
      </div>
      <div className="card p-4 flex items-center gap-3">
        <span className={`pill pill-dot ${atrasado ? 'pill-warn' : 'pill-ok'}`}>{atrasado ? 'Sem envio nas últimas 36 h' : 'Em dia'}</span>
        <span className="text-[13px] text-fg-2">{ultima ? `Último envio: ${dataCurta(ultima.iniciada_em, true)} às ${horaSP(ultima.iniciada_em)}` : 'Nenhum envio ainda.'}</span>
      </div>
      {diag && (
        <section className="card p-4">
          <div className="eyebrow mb-2">Diagnóstico inicial</div>
          <pre className="mono text-[12px] whitespace-pre-wrap text-fg-2">{JSON.stringify(diag, null, 2)}</pre>
        </section>
      )}
      <div className="lista">
        {execs.map((e, i) => (
          <div key={i} className="linha">
            <span className="flex-1"><div className="linha-titulo mono">{dataCurta(e.iniciada_em, true)} {horaSP(e.iniciada_em)}</div>
              <div className="linha-sub">{e.empresas} empresas · {e.contatos} contatos · {e.contas} contas</div></span>
            {e.erro ? <span className="pill st-atrasado">{e.erro}</span> : <span className="pill st-conferido">OK</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
