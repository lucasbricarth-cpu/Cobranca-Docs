'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Check, X } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { dataCurta } from '@/lib/tempo';

interface Dados {
  numeros: { id: string; numero: string; confirmado_em: string; quem: string; ativo: boolean }[];
  sugestoes: { numero: string; origem: string; empresa: string }[];
  aceite: { aceito_em: string; canal: string; revogado_em: string | null } | null;
}
const fmt = (n: string) => `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, -4)}-${n.slice(-4)}`;

/** Número de WhatsApp (só vale depois que um funcionário confirma) e aceite do contato (data e canal). */
export function WhatsAppDoLogin({ loginId }: { loginId: string }) {
  const [d, setD] = useState<Dados | null>(null);
  const [novo, setNovo] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  const [data, setData] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => { const r = await chamar<Dados>(`/api/logins/${loginId}/whatsapp`); if (r.ok) setD(r); }, [loginId]);
  useEffect(() => { carregar(); }, [carregar]);
  const enviar = async (corpo: Record<string, unknown>) => { setErro(null); const r = await chamar(`/api/logins/${loginId}/whatsapp`, 'POST', corpo); if (!r.ok) setErro(r.erro ?? 'Erro'); await carregar(); };
  if (!d) return null;
  const ativos = d.numeros.filter((n) => n.ativo);
  const aceito = d.aceite && !d.aceite.revogado_em;
  return (
    <div className="mt-2 pt-2 border-t border-[var(--gline-2)] flex flex-col gap-2 text-[12.5px]">
      <div className="flex items-center gap-1.5 text-fg-3"><MessageCircle size={13} />WhatsApp</div>
      {ativos.map((n) => (
        <div key={n.id} className="flex items-center gap-2"><span className="mono">{fmt(n.numero)}</span><span className="text-fg-4">confirmado por {n.quem} em {dataCurta(n.confirmado_em)}</span>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => enviar({ desligar: n.id })}>Desligar</button></div>
      ))}
      {!ativos.length && d.sugestoes.map((s) => (
        <div key={s.numero} className="flex items-center gap-2 flex-wrap"><span className="mono">{fmt(s.numero)}</span><span className="text-fg-4">{s.origem} · sugestão</span>
          <button className="btn btn-sm ml-auto" onClick={() => enviar({ confirmar: s.numero })}><Check size={13} />Confirmar</button></div>
      ))}
      <div className="flex gap-2">
        <input className="input mono" style={{ minHeight: 32 }} placeholder="DDD + número" value={novo} onChange={(e) => setNovo(e.target.value)} aria-label="Número de WhatsApp" />
        <button className="btn btn-sm" disabled={novo.replace(/\D/g, '').length < 10} onClick={async () => { await enviar({ confirmar: novo }); setNovo(''); }}>Confirmar número</button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {aceito ? (
          <><span className="pill st-conferido">Aceite em {dataCurta(d.aceite!.aceito_em, true)} ({d.aceite!.canal})</span>
            <button className="btn btn-ghost btn-sm" onClick={() => enviar({ revogarAceite: true })}><X size={13} />Revogar</button></>
        ) : (
          <><span className="pill st-pendente">Sem aceite: nada automático pelo WhatsApp</span>
            <select className="input" style={{ width: 130, minHeight: 32 }} value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal do aceite">
              {['whatsapp', 'app', 'email', 'presencial', 'telefone', 'contrato'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="input" style={{ width: 150, minHeight: 32 }} value={data} onChange={(e) => setData(e.target.value)} aria-label="Data do aceite" />
            <button className="btn btn-sm" onClick={() => enviar({ aceite: { canal, data: data || null } })}>Registrar aceite</button></>
        )}
      </div>
      {erro && <span className="pill pill-danger pill-dot self-start">{erro}</span>}
    </div>
  );
}
