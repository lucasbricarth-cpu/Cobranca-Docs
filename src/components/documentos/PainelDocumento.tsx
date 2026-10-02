'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { VisualizadorPdf } from './VisualizadorPdf';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, X, FolderInput, CheckCheck, RotateCcw, Lock, FileCode2 } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ClassificarModal, type OpcoesClassificar } from './ClassificarModal';
import { dataCurta, horaSP, mesCurto } from '@/lib/tempo';
import type { ArquivoDaLista } from '@/lib/documentos/consultas';

interface Acesso { acao: string; quem: string; lado: 'escritorio' | 'cliente'; em: string }
const VERBOS: Record<string, string> = { abrir: 'abriu', baixar: 'baixou', exportar: 'exportou', miniatura: 'viu a miniatura' };
interface Auditoria { acao: string; de: Record<string, unknown> | null; para: Record<string, unknown> | null; quem: string; em: string }

const ACOES: Record<string, string> = {
  classificado: 'Classificou', conferido: 'Conferiu', conferido_automatico: 'Conferido automaticamente', rejeitado: 'Rejeitou e pediu de novo',
  substituido: 'Substituído por um arquivo novo', empresa_trocada_cliente: 'O cliente mudou a empresa', mudou_empresa: 'Mudou a empresa',
};

/**
 * Pré-visualização à direita (computador) ou em folha cheia (celular). O
 * arquivo abre sem baixar, por um link temporário. Ações do escritório:
 * Classificar, Conferir e "Rejeitar e pedir de novo".
 */
export function PainelDocumento({ docId, hrefFechar, tipos, empresas, podeAgir = true, nomesEmpresas }: {
  docId?: string; hrefFechar: string; podeAgir?: boolean;
  tipos: { id: string; nome: string; subtipo_origem: string | null }[]; empresas?: { id: string; nome: string }[];
  nomesEmpresas?: Record<string, string>;
}) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [doc, setDoc] = useState<ArquivoDaLista | null>(null);
  const [aud, setAud] = useState<Auditoria[]>([]);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [classificar, setClassificar] = useState<OpcoesClassificar | null>(null);
  const [rejeitar, setRejeitar] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    setDoc(null); setUrl(null); setErro(null); setAud([]); setAcessos([]);
    if (!docId) return;
    let cancelado = false;
    (async () => {
      const r = await chamar<{ documento: ArquivoDaLista; auditoria: Auditoria[]; acessos: Acesso[] }>(`/api/documentos/${docId}`);
      if (cancelado) return;
      if (!r.ok) return setErro(r.erro ?? 'Não foi possível abrir.');
      setDoc(r.documento); setAud(r.auditoria ?? []); setAcessos(r.acessos ?? []);
      if (['pdf', 'jpg', 'png', 'webp'].includes(r.documento.extensao)) {
        const u = await chamar<{ url: string }>(`/api/documentos/${docId}/url?modo=abrir`);
        if (!cancelado && u.ok) setUrl(u.url);
      }
    })();
    return () => { cancelado = true; };
  }, [docId]);

  // Em telas estreitas a folha vai direto no <body> (portal), acima de qualquer cabeçalho ou barra.
  const [estreito, setEstreito] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 1099px)');
    const f = () => setEstreito(m.matches);
    f(); m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  if (!docId) return <aside className="painel-doc vazio"><div className="vazio">Escolha um documento para ver aqui, sem baixar.</div></aside>;

  async function baixar() {
    const r = await chamar<{ url: string }>(`/api/documentos/${docId}/url?modo=baixar`);
    if (r.ok) window.location.href = r.url; else avisar(r.erro ?? 'Erro', 'erro');
  }
  async function conferir() {
    const r = await chamar(`/api/documentos/${docId}/conferir`, 'POST');
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    avisar('Conferido.'); router.refresh(); setDoc(doc ? { ...doc, status: 'conferido' } : doc);
  }
  async function enviarRejeicao() {
    const r = await chamar(`/api/documentos/${docId}/rejeitar`, 'POST', { motivo });
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    setRejeitar(false); setMotivo(''); avisar('Rejeitado. O cliente foi avisado para enviar de novo.'); router.refresh();
    setDoc(doc ? { ...doc, status: 'rejeitado' } : doc);
  }

  const painel = (
    <aside className="painel-doc" aria-label="Documento">
      <div className="painel-doc-cab">
        <div className="min-w-0 flex-1">
          <div className="h3 truncate">{doc ? (doc.status === 'nao_reconhecido' ? doc.nome_original : doc.nome) : '…'}</div>
          {doc && <div className="text-[11.5px] text-fg-3 truncate">{doc.empresa_nome ?? (doc.whatsapp_numero ? `+${doc.whatsapp_numero}` : 'Sem empresa')}</div>}
        </div>
        <Link href={hrefFechar} scroll={false} className="btn btn-ghost btn-icon" aria-label="Fechar"><X size={16} /></Link>
      </div>
      {erro && <div className="vazio m-3">{erro}</div>}
      {doc && (
        <div className="painel-doc-corpo">
          <div className="painel-doc-ver">
            {doc.sensivel && !url ? <div className="vazio"><Lock size={18} className="mx-auto mb-1" />Documento sensível.</div> : null}
            {url && doc.mime === 'application/pdf' && <VisualizadorPdf url={url} titulo={doc.nome} />}
            {url && doc.mime.startsWith('image/') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={doc.nome} />
            )}
            {!url && !doc.sensivel && !['pdf', 'jpg', 'png', 'webp'].includes(doc.extensao) && <div className="vazio"><FileCode2 size={18} className="mx-auto mb-1" />Arquivo {doc.extensao.toUpperCase()}: baixe para abrir.</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={baixar}><Download size={14} />Baixar</button>
            {podeAgir && <button className="btn btn-sm" onClick={() => setClassificar({ documentoId: doc.id, empresaId: doc.empresa_id, tipoId: doc.tipo_id, subtipoId: doc.subtipo_id, competencia: doc.competencia, nome: doc.nome_original })}><FolderInput size={14} />Classificar</button>}
            {podeAgir && doc.status === 'a_conferir' && <button className="btn btn-sm btn-primary" onClick={conferir}><CheckCheck size={14} />Conferir</button>}
            {podeAgir && ['a_conferir', 'conferido', 'nao_reconhecido'].includes(doc.status) && doc.empresa_id && <button className="btn btn-sm" onClick={() => setRejeitar(true)}><RotateCcw size={14} />Rejeitar e pedir de novo</button>}
          </div>
          {(() => {
            const sg = (doc.sugestao?.sugerido ?? doc.sugestao?.previa) as { rotulo?: string; origem?: string; trecho?: string; novaConta?: string | null } | undefined;
            if (!sg?.rotulo) return null;
            const origem = sg.origem === 'ia' ? 'IA' : sg.origem === 'xml' ? 'XML da nota' : sg.origem === 'ofx' ? 'arquivo OFX' : 'análise';
            return (
              <section className="card p-3 flex flex-col gap-1">
                <div className="eyebrow">Sugestão ({origem})</div>
                <div className="text-[13.5px]">{sg.rotulo}</div>
                {sg.novaConta && <span className="pill pill-warn pill-dot self-start">Nova conta encontrada: {sg.novaConta}</span>}
                {sg.trecho && <div className="text-[12px] text-fg-3 italic line-clamp-3">“{sg.trecho}”</div>}
              </section>
            );
          })()}
          <dl className="painel-doc-dl">
            <dt>Nome original</dt><dd className="break-all">{doc.nome_original}</dd>
            {doc.tipo_nome && <><dt>Tipo</dt><dd>{doc.tipo_nome}{doc.subtipo_rotulo ? ` › ${doc.subtipo_rotulo}` : ''}</dd></>}
            {doc.competencia && <><dt>Mês</dt><dd>{mesCurto(doc.competencia)}</dd></>}
            <dt>Recebido</dt><dd>{dataCurta(doc.recebido_em, true)} às {horaSP(new Date(doc.recebido_em))} · {doc.origem === 'whatsapp' ? 'WhatsApp' : doc.origem === 'app' ? 'app' : 'escritório'}{doc.enviado_por ? ` · ${doc.enviado_por}` : ''}</dd>
            {doc.motivo_rejeicao && <><dt>Motivo da rejeição</dt><dd>{doc.motivo_rejeicao}</dd></>}
            <dt>Download</dt><dd className="mono text-[11.5px] break-all">{doc.nome_download}</dd>
          </dl>
          {aud.length > 0 && (
            <section>
              <div className="eyebrow mb-1.5">Histórico</div>
              <ol className="flex flex-col gap-1.5">
                {aud.map((a, i) => (
                  <li key={i} className="text-[12px] text-fg-2">
                    <b className="text-fg">{a.quem}</b> · {ACOES[a.acao] ?? a.acao} · <span className="mono text-fg-4">{dataCurta(a.em)} {horaSP(new Date(a.em))}</span>
                    {a.de && a.para && <div className="text-fg-4">{descreverMudanca(a.de, a.para, tipos, nomesEmpresas)}</div>}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {acessos.length > 0 && (
            <details className="painel-doc-acessos">
              <summary className="eyebrow cursor-pointer select-none">Registro de acesso · {acessos.length}{acessos.length >= 50 ? '+' : ''}</summary>
              <ol className="flex flex-col gap-1 mt-1.5">
                {acessos.map((a, i) => (
                  <li key={i} className="text-[12px] text-fg-2">
                    <b className="text-fg">{a.quem}</b>{a.lado === 'cliente' ? ' (cliente)' : ''} · {VERBOS[a.acao] ?? a.acao} · <span className="mono text-fg-4">{dataCurta(a.em)} {horaSP(new Date(a.em))}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
      <ClassificarModal abrir={classificar} aoFechar={() => setClassificar(null)} tipos={tipos} empresas={doc && !doc.empresa_id ? empresas : empresas && doc?.status === 'nao_reconhecido' ? empresas : undefined}
        aoSalvar={(m) => { setClassificar(null); avisar(m); router.refresh(); setDoc(null); router.push(hrefFechar, { scroll: false }); }} />
      <Modal aberto={rejeitar} aoFechar={() => setRejeitar(false)} titulo="Rejeitar e pedir de novo" subtitulo="O item reabre e o cliente recebe o motivo." icone={<RotateCcw />}
        rodape={<><button className="btn" onClick={() => setRejeitar(false)}>Cancelar</button><button className="btn btn-primary" disabled={motivo.trim().length < 3} onClick={enviarRejeicao}>Rejeitar e avisar</button></>}>
        <div className="campo"><label className="label" htmlFor="rj-motivo">Motivo (o cliente vê este texto)</label>
          <textarea id="rj-motivo" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="A foto ficou ilegível. Envie de novo, por favor." /></div>
        <div className="chips mt-2">
          {['A foto ficou ilegível. Envie de novo, por favor.', 'Faltam páginas. Envie o documento completo, por favor.', 'Este não é o mês pedido.'].map((m) => (
            <button key={m} type="button" className="chip" onClick={() => setMotivo(m)}>{m}</button>
          ))}
        </div>
      </Modal>
      {toast}
    </aside>
  );
  return estreito && typeof document !== 'undefined' ? createPortal(painel, document.body) : painel;
}

function descreverMudanca(de: Record<string, unknown>, para: Record<string, unknown>, tipos: { id: string; nome: string }[], empresas?: Record<string, string>): string {
  const partes: string[] = [];
  const nomeTipo = (id: unknown) => tipos.find((t) => t.id === id)?.nome ?? '—';
  if (de.empresa_id !== para.empresa_id) partes.push(`empresa: ${empresas?.[String(de.empresa_id)] ?? (de.empresa_id ? 'outra' : 'nenhuma')} → ${empresas?.[String(para.empresa_id)] ?? 'outra'}`);
  if (de.tipo_id !== para.tipo_id) partes.push(`tipo: ${nomeTipo(de.tipo_id)} → ${nomeTipo(para.tipo_id)}`);
  if (de.subtipo_id !== para.subtipo_id) partes.push('subtipo alterado');
  if (de.competencia !== para.competencia) partes.push(`mês: ${de.competencia ? mesCurto(String(de.competencia)) : '—'} → ${para.competencia ? mesCurto(String(para.competencia)) : '—'}`);
  if (para.motivo) partes.push(`motivo: ${para.motivo}`);
  return partes.join(' · ');
}
