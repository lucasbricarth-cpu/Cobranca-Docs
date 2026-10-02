'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Plus, X } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';

/** Empresas do piloto: com alguma marcada, a agenda e os avisos automáticos ao cliente só valem para elas. */
export function EmpresasPiloto({ piloto, candidatas }: {
  piloto: { id: string; nome: string; responsavel: string | null; responsavelId: string | null }[];
  candidatas: { id: string; nome: string; responsavel: string | null }[];
}) {
  const router = useRouter();
  const [escolha, setEscolha] = useState('');
  const marcar = async (id: string, valor: boolean) => { await chamar(`/api/empresas/${id}/piloto`, 'PATCH', { piloto: valor }); setEscolha(''); router.refresh(); };
  const responsaveis = new Set(piloto.map((p) => p.responsavelId ?? 'nenhum'));
  return (
    <section className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="icone-id"><FlaskConical /></span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Empresas do piloto</div>
          <p className="text-[12.5px] text-fg-3">
            {piloto.length
              ? <>Modo piloto ligado: a agenda e os avisos automáticos (push, e-mail e WhatsApp) só valem para estas <b className="mono">{piloto.length}</b> empresas. Tire todas para liberar a carteira inteira.</>
              : 'Nenhuma empresa marcada: o app vale para a carteira inteira. Marque algumas para começar o piloto.'}
          </p>
        </div>
      </div>
      {piloto.length > 0 && (
        <div className="chips">
          {piloto.map((p) => (
            <span key={p.id} className="chip cursor-default">{p.nome}<span className="text-fg-4 font-normal">{p.responsavel ? ` · ${p.responsavel}` : ''}</span>
              <button type="button" aria-label={`Tirar ${p.nome} do piloto`} onClick={() => marcar(p.id, false)}><X size={13} /></button></span>
          ))}
        </div>
      )}
      {piloto.length > 1 && responsaveis.size < 2 && <div className="pill pill-warn pill-dot self-start">Todas do mesmo responsável: o piloto pede responsáveis diferentes.</div>}
      <div className="flex gap-2 flex-wrap">
        <select className="input flex-1 min-w-[220px]" value={escolha} onChange={(e) => setEscolha(e.target.value)} aria-label="Empresa para o piloto">
          <option value="">Escolha uma empresa…</option>
          {candidatas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.responsavel ? ` · ${c.responsavel}` : ''}</option>)}
        </select>
        <button className="btn" disabled={!escolha} onClick={() => marcar(escolha, true)}><Plus size={14} />Pôr no piloto</button>
      </div>
    </section>
  );
}
