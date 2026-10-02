'use client';

import { useEffect, useState } from 'react';
import { FolderInput } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { chamar } from '@/components/ui/cliente-http';

export interface OpcoesClassificar {
  documentoId: string;
  empresaId: string | null;
  tipoId?: string | null;
  subtipoId?: string | null;
  competencia?: string | null;
  nome?: string;
}

/** "Classificar": empresa (só na pasta geral), tipo, subtipo e mês. A mudança fica registrada. */
export function ClassificarModal({ abrir, aoFechar, aoSalvar, tipos, empresas }: {
  abrir: OpcoesClassificar | null; aoFechar: () => void; aoSalvar: (msg: string) => void;
  tipos: { id: string; nome: string; subtipo_origem: string | null }[]; empresas?: { id: string; nome: string }[];
}) {
  const [empresaId, setEmpresaId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [subtipoId, setSubtipoId] = useState('');
  const [mes, setMes] = useState('');
  const [subtipos, setSubtipos] = useState<{ id: string; rotulo: string; ativo: boolean }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!abrir) return;
    setEmpresaId(abrir.empresaId ?? ''); setTipoId(abrir.tipoId ?? ''); setSubtipoId(abrir.subtipoId ?? '');
    setMes(abrir.competencia ? abrir.competencia.slice(0, 7) : ''); setErro(null);
  }, [abrir]);
  useEffect(() => {
    setSubtipos([]);
    if (!empresaId || !tipoId) return;
    const t = tipos.find((x) => x.id === tipoId);
    if (!t?.subtipo_origem) return;
    chamar<{ subtipos: { id: string; rotulo: string; ativo: boolean }[] }>(`/api/empresas/${empresaId}/subtipos?tipo=${tipoId}`).then((r) => setSubtipos(r.subtipos ?? []));
  }, [empresaId, tipoId, tipos]);

  const tipo = tipos.find((x) => x.id === tipoId);
  const precisaSub = Boolean(tipo?.subtipo_origem && tipo.subtipo_origem !== 'livre');
  const pronto = empresaId && tipoId && mes && (!precisaSub || subtipoId);

  async function salvar(conferir: boolean) {
    if (!abrir) return;
    setSalvando(true); setErro(null);
    const r = await chamar(`/api/documentos/${abrir.documentoId}`, 'PATCH', { empresaId, tipoId, subtipoId: subtipoId || null, competencia: `${mes}-01`, conferir });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? 'Não foi possível classificar.');
    aoSalvar(conferir ? 'Classificado e conferido.' : 'Classificado.');
  }

  return (
    <Modal aberto={Boolean(abrir)} aoFechar={aoFechar} titulo="Classificar" subtitulo={abrir?.nome} icone={<FolderInput />}
      rodape={<>
        <button className="btn" onClick={() => salvar(false)} disabled={!pronto || salvando}>Classificar</button>
        <button className="btn btn-primary" onClick={() => salvar(true)} disabled={!pronto || salvando}>Classificar e conferir</button>
      </>}>
      {empresas && (
        <div className="campo"><label className="label" htmlFor="cl-emp">Empresa</label>
          <select id="cl-emp" className="input" value={empresaId} onChange={(e) => { setEmpresaId(e.target.value); setSubtipoId(''); }}>
            <option value="">Escolha…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select></div>
      )}
      <div className="campo"><label className="label" htmlFor="cl-tipo">Tipo</label>
        <select id="cl-tipo" className="input" value={tipoId} onChange={(e) => { setTipoId(e.target.value); setSubtipoId(''); }}>
          <option value="">Escolha…</option>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select></div>
      {tipo?.subtipo_origem && (
        <div className="campo"><label className="label" htmlFor="cl-sub">{tipo.subtipo_origem === 'contas' ? 'Conta' : tipo.subtipo_origem === 'cartoes' ? 'Cartão' : 'Subtipo (opcional)'}</label>
          <select id="cl-sub" className="input" value={subtipoId} onChange={(e) => setSubtipoId(e.target.value)}>
            <option value="">{precisaSub ? 'Escolha…' : 'Nenhum'}</option>
            {subtipos.map((s) => <option key={s.id} value={s.id}>{s.rotulo}{s.ativo ? '' : ' (não pedir)'}</option>)}
          </select></div>
      )}
      <div className="campo"><label className="label" htmlFor="cl-mes">Mês de referência</label>
        <input id="cl-mes" type="month" className="input" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
      {erro && <div className="pill pill-danger pill-dot mt-3">{erro}</div>}
    </Modal>
  );
}
