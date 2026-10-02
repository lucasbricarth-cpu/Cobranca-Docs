'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, Sparkles, Building2, CalendarDays } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { api } from './http';
import { cnpjParcial } from '@/lib/texto';
import { nomeDoMes } from '@/lib/tempo';
import type { Analise } from '@/lib/envio/servico';
import type { OpcoesMes } from '@/lib/envio/mes';

export interface ItemDoEnvio { id: string; titulo: string; empresaId: string; tipoId: string; subtipoId: string | null; sensivel: boolean }
interface Tipo { id: string; nome: string; sensivel: boolean; subtipo_origem: string | null }
interface Sub { id: string; tipo_id: string; rotulo: string }

/**
 * Popup depois de "Enviar":
 * - Empresa: só se o login tiver mais de uma e o envio for sem pedido. Se um CNPJ
 *   lido bater com uma empresa do login, ela vem marcada; senão, nada marcado e
 *   o Enviar fica travado até escolher.
 * - Tipo e subtipo: o que a classificação sugeriu; o cliente pode corrigir.
 * - Mês: com pedido, o do pedido; sem pedido, pela regra (um item aberto, vários, ou a regra do tipo).
 */
export function PopupConfirmar({ aberto, analise, item, empresas, sensivel, token, enviando, aoConfirmar, aoFechar }: {
  aberto: boolean; analise: Analise | null; item: ItemDoEnvio | null; empresas: { id: string; nome: string; cnpj: string }[];
  sensivel: boolean; token?: string | null; enviando: boolean;
  aoConfirmar: (c: { empresaId: string; tipoId: string; subtipoId: string | null; competencia: string | null }) => void; aoFechar: () => void;
}) {
  const varias = !item && empresas.length > 1;
  const [empresaId, setEmpresaId] = useState<string>('');
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [tipoId, setTipoId] = useState('');
  const [subtipoId, setSubtipoId] = useState('');
  const [opMes, setOpMes] = useState<OpcoesMes | null>(null);
  const [mes, setMes] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setEmpresaId(item?.empresaId ?? (varias ? analise?.empresaSugerida ?? '' : empresas[0]?.id ?? ''));
    setTipoId(item?.tipoId ?? analise?.sugestao?.tipoId ?? '');
    setSubtipoId(item?.subtipoId ?? analise?.sugestao?.subtipoId ?? '');
  }, [aberto, item, analise, varias, empresas]);

  useEffect(() => {
    if (!aberto || !empresaId) return;
    api<{ tipos: Tipo[]; subtipos: Sub[] }>(`/api/envios/opcoes?empresa=${empresaId}`, 'GET', undefined, token).then((r) => {
      if (!r.ok) return;
      setTipos(r.tipos.filter((t) => (sensivel ? t.sensivel : !t.sensivel) || t.id === item?.tipoId));
      setSubs(r.subtipos);
    });
  }, [aberto, empresaId, sensivel, token, item?.tipoId]);

  const tipo = tipos.find((t) => t.id === tipoId);
  const subsDoTipo = useMemo(() => subs.filter((s) => s.tipo_id === tipoId), [subs, tipoId]);
  const precisaSub = Boolean(!item && tipo?.subtipo_origem && tipo.subtipo_origem !== 'livre' && subsDoTipo.length);

  useEffect(() => {
    setOpMes(null); setMes('');
    if (!aberto || !empresaId || !tipoId) return;
    const p = new URLSearchParams({ empresa: empresaId, tipo: tipoId, ...(subtipoId ? { sub: subtipoId } : {}), ...(item ? { item: item.id } : {}) });
    api<{ opcoes: OpcoesMes }>(`/api/envios/mes?${p}`, 'GET', undefined, token).then((r) => {
      if (!r.ok) return;
      setOpMes(r.opcoes);
      if (r.opcoes.modo === 'regra') setMes(r.opcoes.competencia.slice(0, 7));
    });
  }, [aberto, empresaId, tipoId, subtipoId, item, token]);

  const mesOk = opMes && (opMes.modo !== 'escolher' || Boolean(mes)) && (opMes.modo !== 'regra' || Boolean(mes));
  const pronto = Boolean(empresaId && tipoId && (!precisaSub || subtipoId) && mesOk);
  const empresaSugerida = analise?.empresaSugerida ? empresas.find((e) => e.id === analise.empresaSugerida) : null;
  const sug = analise?.sugestao;

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Confirmar envio" subtitulo={item ? `Para o pedido: ${item.titulo}` : 'Confira antes de enviar'} icone={<Send />}
      rodape={<>
        <button className="btn" onClick={aoFechar}>Voltar</button>
        <button className="btn btn-primary" disabled={!pronto || enviando} onClick={() => aoConfirmar({ empresaId, tipoId, subtipoId: subtipoId || null, competencia: mes ? (mes.length === 7 ? `${mes}-01` : mes) : null })}>
          <Send size={15} />{enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </>}>
      {varias && (
        <fieldset className="campo">
          <legend className="label flex items-center gap-1.5"><Building2 size={13} />Empresa</legend>
          {empresaSugerida && <div className="pill pill-gold pill-dot mb-2 self-start">Encontramos o CNPJ da {empresaSugerida.nome}</div>}
          <div className="lista" role="radiogroup">
            {empresas.map((e) => (
              <label key={e.id} className={`linha ${empresaId === e.id ? 'is-on' : ''}`} style={{ minHeight: 52, cursor: 'pointer' }}>
                <input type="radio" name="empresa" className="sw" checked={empresaId === e.id} onChange={() => { setEmpresaId(e.id); setSubtipoId(''); }} />
                <span className="flex-1 min-w-0"><div className="linha-titulo truncate">{e.nome}</div><div className="linha-sub mono">{cnpjParcial(e.cnpj)}</div></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {!item && (
        <div className="campo">
          <span className="label flex items-center gap-1.5"><Sparkles size={13} />Tipo do documento</span>
          {sug && !sensivel && <div className="pill pill-gold mb-2 self-start">Identificamos: {sug.rotulo}</div>}
          <select className="input" aria-label="Tipo" value={tipoId} onChange={(e) => { setTipoId(e.target.value); setSubtipoId(''); }} disabled={!empresaId}>
            <option value="">{empresaId ? 'Escolha o tipo…' : 'Escolha a empresa primeiro'}</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {tipo?.subtipo_origem && subsDoTipo.length > 0 && (
            <select className="input mt-2" aria-label="Conta ou cartão" value={subtipoId} onChange={(e) => setSubtipoId(e.target.value)}>
              <option value="">{precisaSub ? (tipo.subtipo_origem === 'contas' ? 'Qual conta?' : 'Qual cartão?') : 'Nenhum'}</option>
              {subsDoTipo.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="campo">
        <span className="label flex items-center gap-1.5"><CalendarDays size={13} />Mês de referência</span>
        {!opMes && <div className="text-[13px] text-fg-3">{tipoId ? '…' : 'Escolha o tipo.'}</div>}
        {opMes && (opMes.modo === 'pedido' || opMes.modo === 'item') && <div className="text-[14px]">{nomeDoMes(opMes.competencia)}{opMes.modo === 'item' ? ' · vai para o pedido em aberto' : ''}</div>}
        {opMes?.modo === 'escolher' && (
          <>
            <div className="text-[13.5px] mb-2">Este documento é de qual mês?</div>
            <div className="chips" role="radiogroup">
              {opMes.meses.map((m) => (
                <button key={m.competencia} type="button" role="radio" aria-checked={mes === m.competencia} className={`chip ${mes === m.competencia ? 'active' : ''}`} onClick={() => setMes(m.competencia)}>{nomeDoMes(m.competencia)}</button>
              ))}
            </div>
          </>
        )}
        {opMes?.modo === 'regra' && <input type="month" className="input" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês de referência" />}
      </div>
      {analise?.avisos?.map((a) => <div key={a} className="pill pill-warn pill-dot mt-3">{a}</div>)}
    </Modal>
  );
}
