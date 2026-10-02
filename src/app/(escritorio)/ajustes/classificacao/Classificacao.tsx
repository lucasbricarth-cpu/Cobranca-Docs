'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';

interface Taxa { total: number; acertos_tipo: number; com_subtipo: number; acertos_subtipo: number }
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Arquivamento automático por tipo (começa desligado) e a taxa de acerto medida nas correções do funcionário. */
export function Classificacao({ tipos, taxa }: { tipos: { id: string; nome: string; sensivel: boolean; auto: boolean }[]; taxa: Record<string, Taxa> }) {
  const router = useRouter();
  return (
    <section className="flex flex-col gap-2">
      <div className="lista">
        {tipos.map((t) => {
          const x = taxa[t.id];
          return (
            <div key={t.id} className="linha">
              <span className="flex-1 min-w-0">
                <div className="linha-titulo flex items-center gap-1.5">{t.sensivel && <Lock size={12} aria-label="Sensível" />}{t.nome}</div>
                <div className="linha-sub">
                  {x?.total ? <>Acerto do tipo <b className="mono texto-destaque">{pct(x.acertos_tipo, x.total)}</b>{x.com_subtipo ? <> · do subtipo <b className="mono texto-destaque">{pct(x.acertos_subtipo, x.com_subtipo)}</b></> : null} · <span className="mono">{x.total}</span> conferidos</> : 'Sem conferências com sugestão ainda'}
                </div>
              </span>
              {t.sensivel ? <span className="text-[11.5px] text-fg-3 text-right max-w-[110px]">Sempre por uma pessoa</span> : (
                <label className="flex items-center gap-2 text-[12px] text-fg-3">Arquivar sozinho
                  <input type="checkbox" className="sw" checked={t.auto}
                    onChange={async (e) => { await chamar(`/api/tipos/${t.id}`, 'PATCH', { arquivamento_automatico: e.target.checked }); router.refresh(); }} />
                </label>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[12px] text-fg-3 mt-1">Com o automático ligado, um arquivo só é conferido sozinho quando o CNPJ é o da empresa do pedido, o tipo e o subtipo são os do pedido, e o envio tinha pedido. Foto ou PDF sem pedido nunca.</p>
    </section>
  );
}
