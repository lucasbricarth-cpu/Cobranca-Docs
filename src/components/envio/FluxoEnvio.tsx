'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Building2, HeartPulse } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Scanner } from './Scanner';
import { PopupConfirmar, type ItemDoEnvio } from './PopupConfirmar';
import { api, enviarBytes } from './http';
import { guardarEnvio, temSincronizacaoEmSegundoPlano } from './fila-offline';
import type { Analise } from '@/lib/envio/servico';

/**
 * Um envio, do arquivo até "Enviado para a Empresa X":
 * câmera (scanner) ou arquivo → (sem pedido) "É documento de saúde de funcionário?"
 * → upload com URL assinada → análise → popup de confirmação → pronto, com "Mudar empresa".
 * Sem sinal, o envio fica guardado no aparelho.
 */
type Etapa = 'camera' | 'sensivel' | 'enviando' | 'confirmar' | 'pronto' | 'guardado' | 'erro';

export function FluxoEnvio({ fonte, arquivoInicial, item, empresas, token, aoTerminar, aoFechar }: {
  fonte: 'camera' | 'arquivo'; arquivoInicial?: File | null; item: ItemDoEnvio | null;
  empresas: { id: string; nome: string; cnpj: string }[]; token?: string | null;
  aoTerminar?: () => void; aoFechar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(fonte === 'camera' ? 'camera' : item ? 'enviando' : 'sensivel');
  const [arquivo, setArquivo] = useState<File | null>(arquivoInicial ?? null);
  const [sensivel, setSensivel] = useState(Boolean(item?.sensivel));
  const [progresso, setProgresso] = useState(0);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<{ documentoId: string; empresaId: string; empresaNome: string } | null>(null);
  const [mudando, setMudando] = useState(false);

  // Começa o upload assim que há arquivo e (sem pedido) a pergunta do sensível foi respondida.
  useEffect(() => {
    if (etapa !== 'enviando' || !arquivo) return;
    let cancelado = false;
    (async () => {
      setProgresso(0); setErro(null);
      const ini = await api<{ uploadId: string; url: string; cabecalhos: Record<string, string> }>('/api/envios/iniciar', 'POST', { nomeOriginal: arquivo.name, mime: arquivo.type || 'application/octet-stream', itemId: item?.id ?? null }, token);
      if (cancelado) return;
      if (!ini.ok) return ini.erro === 'sem-rede' ? guardar() : falhar(ini.erro);
      const subiu = await enviarBytes(ini.url, ini.cabecalhos, arquivo, (p) => !cancelado && setProgresso(p));
      if (cancelado) return;
      if (!subiu) return navigator.onLine ? falhar('Não foi possível enviar o arquivo. Tente de novo.') : guardar();
      setUploadId(ini.uploadId);
      const an = await api<{ analise: Analise }>(`/api/envios/${ini.uploadId}/analisar`, 'POST', { sensivel }, token);
      if (cancelado) return;
      if (!an.ok) return falhar(an.erro);
      setAnalise(an.analise);
      setEtapa('confirmar');
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, arquivo]);

  function falhar(msg?: string) { setErro(msg && msg !== 'sem-rede' ? msg : 'Algo deu errado. Tente de novo.'); setEtapa('erro'); }
  async function guardar() {
    if (!arquivo) return;
    await guardarEnvio({ nome: arquivo.name, mime: arquivo.type, arquivo, itemId: item?.id ?? null, empresaId: item?.empresaId ?? (empresas.length === 1 ? empresas[0].id : null),
      tipoId: item?.tipoId ?? null, subtipoId: item?.subtipoId ?? null, titulo: item?.titulo ?? 'Documento sem pedido', sensivel, token: token ?? null } as Parameters<typeof guardarEnvio>[0]);
    setEtapa('guardado');
  }

  async function confirmar(c: { empresaId: string; tipoId: string; subtipoId: string | null; competencia: string | null }) {
    if (!uploadId) return;
    setConfirmando(true);
    const r = await api<{ documentoId: string; empresaId: string; empresaNome: string; duplicado: boolean }>(`/api/envios/${uploadId}/confirmar`, 'POST', c, token);
    setConfirmando(false);
    if (!r.ok) return falhar(r.erro);
    setResultado({ documentoId: r.documentoId, empresaId: r.empresaId, empresaNome: r.empresaNome });
    setEtapa('pronto');
    aoTerminar?.();
  }

  async function mudarEmpresa(empresaId: string) {
    if (!resultado) return;
    const r = await api(`/api/envios/documento/${resultado.documentoId}/empresa`, 'POST', { empresaId }, token);
    if (!r.ok) return setErro(r.erro ?? 'Não foi possível mudar.');
    const e = empresas.find((x) => x.id === empresaId)!;
    setResultado({ ...resultado, empresaId, empresaNome: e.nome });
    setMudando(false);
    aoTerminar?.();
  }

  if (etapa === 'camera') {
    return <Scanner titulo={item?.titulo} aoFechar={aoFechar} aoConcluir={(pdf) => { setArquivo(pdf); setEtapa(item ? 'enviando' : 'sensivel'); }} />;
  }
  return (
    <>
      <Modal aberto={etapa === 'sensivel'} aoFechar={aoFechar} titulo="Antes de enviar" icone={<HeartPulse />}
        rodape={<>
          <button className="btn" onClick={() => { setSensivel(true); setEtapa('enviando'); }}>Sim</button>
          <button className="btn btn-primary" onClick={() => { setSensivel(false); setEtapa('enviando'); }}>Não</button>
        </>}>
        <p className="text-[14.5px]">É documento de saúde de funcionário, ou sindical?</p>
        <p className="text-[12.5px] text-fg-3 mt-2">Atestados, exames e documentos sindicais são guardados com mais cuidado: não passam pela leitura automática e só a equipe da folha vê.</p>
      </Modal>

      <Modal aberto={etapa === 'enviando'} aoFechar={aoFechar} titulo="Enviando" subtitulo={arquivo?.name}>
        <div className="barra my-2" role="progressbar" aria-valuenow={Math.round(progresso * 100)} aria-valuemin={0} aria-valuemax={100}><i className="b-conferidos" style={{ width: `${Math.max(4, progresso * 100)}%` }} /></div>
        <p className="text-[13px] text-fg-3">{progresso < 1 ? `${Math.round(progresso * 100)}%` : 'Conferindo o arquivo…'}</p>
      </Modal>

      <PopupConfirmar aberto={etapa === 'confirmar'} analise={analise} item={item} empresas={empresas} sensivel={sensivel} token={token} enviando={confirmando}
        aoConfirmar={confirmar} aoFechar={aoFechar} />

      <Modal aberto={etapa === 'pronto'} aoFechar={aoFechar} titulo={`Enviado para a ${resultado?.empresaNome ?? ''}`} icone={<CheckCircle2 />}
        rodape={<>
          {!item && empresas.length > 1 && !mudando && <button className="btn" onClick={() => setMudando(true)}><Building2 size={15} />Mudar empresa</button>}
          <button className="btn btn-primary" onClick={aoFechar}>Pronto</button>
        </>}>
        <p className="text-[14px]">O escritório vai conferir. Você vê o andamento em Enviados.</p>
        {mudando && (
          <div className="lista mt-3">
            {empresas.filter((e) => e.id !== resultado?.empresaId).map((e) => (
              <button key={e.id} className="linha" onClick={() => mudarEmpresa(e.id)}><span className="flex-1 text-left"><div className="linha-titulo">{e.nome}</div></span><span className="text-[12px] texto-destaque">Mover para esta</span></button>
            ))}
          </div>
        )}
        {erro && <div className="pill pill-danger pill-dot mt-3">{erro}</div>}
      </Modal>

      <Modal aberto={etapa === 'guardado'} aoFechar={aoFechar} titulo="Guardado no aparelho" icone={<CloudOff />} rodape={<button className="btn btn-primary" onClick={aoFechar}>Entendi</button>}>
        <p className="text-[14px]">Você está sem sinal. O envio ficou guardado e sobe {temSincronizacaoEmSegundoPlano() ? 'sozinho quando a internet voltar' : 'quando você abrir o app de novo com internet'}.</p>
      </Modal>

      <Modal aberto={etapa === 'erro'} aoFechar={aoFechar} titulo="Não foi possível enviar" rodape={<><button className="btn" onClick={aoFechar}>Fechar</button><button className="btn btn-primary" onClick={() => setEtapa(item || sensivel !== undefined ? 'enviando' : 'sensivel')}>Tentar de novo</button></>}>
        <p className="text-[14px]">{erro}</p>
      </Modal>
    </>
  );
}
