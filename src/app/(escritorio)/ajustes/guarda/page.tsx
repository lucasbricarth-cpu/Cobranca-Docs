import Link from 'next/link';
import { exigirAdmin } from '@/lib/auth/sessao';
import { vencidos, aVencerNaPastaGeral, historicoDeExclusoes, prazos } from '@/lib/guarda';
import { dataSP } from '@/lib/tempo';
import { Guarda } from './Guarda';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Guarda e exclusões' };

const serial = <T extends { recebido_em: Date }>(l: T[]) => l.map((d) => ({ ...d, recebido_em: d.recebido_em.toISOString() }));

export default async function PaginaGuarda() {
  await exigirAdmin();
  const hoje = dataSP();
  const [venc, aVencer, historico] = await Promise.all([vencidos(hoje), aVencerNaPastaGeral(hoje), historicoDeExclusoes()]);
  const p = prazos();
  return (
    <div className="max-w-[960px] flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina mb-1">Guarda e exclusões</h1>
        <p className="text-[13px] text-fg-3">O app nunca apaga sozinho. Todo dia ele lista o que venceu e avisa os Admins; um Admin aprova a exclusão. Datas no fuso de São Paulo.</p>
      </div>
      <div className="card p-4 grid gap-3 md:grid-cols-3 text-[12.5px] text-fg-3">
        <div><div className="eyebrow mb-1">Prazo por tipo</div>Contado do fim do mês do documento. <Link href="/ajustes/tipos" className="underline">Ajustar em Tipos</Link>.</div>
        <div><div className="eyebrow mb-1">Pasta geral (sem empresa)</div><b className="mono texto-destaque">{p.pastaGeralDias}</b> dias do recebimento, com aviso <span className="mono">{p.pastaGeralAvisoDias}</span> dias antes. <span className="pill pill-warn">[DECIDIR]</span></div>
        <div><div className="eyebrow mb-1">Saída de um cliente</div>Na pasta da empresa › Saída: exportar tudo em ZIP e, depois, a exclusão.</div>
      </div>
      <Guarda
        vencidosGuarda={serial(venc.filter((d) => d.motivo === 'guarda'))}
        vencidosPasta={serial(venc.filter((d) => d.motivo === 'pasta_geral'))}
        aVencer={serial(aVencer)}
        historico={historico.map((h) => ({ ...h, aprovado_em: h.aprovado_em.toISOString() }))}
      />
    </div>
  );
}
