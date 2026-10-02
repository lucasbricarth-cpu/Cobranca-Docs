'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, RefreshCw } from 'lucide-react';
import { enviosGuardados, removerEnvio, marcarErro, temSincronizacaoEmSegundoPlano, type EnvioPendente } from './fila-offline';
import { api, enviarBytes } from './http';
import { FluxoEnvio } from './FluxoEnvio';

/**
 * Envios guardados no aparelho (sem sinal). Os que têm pedido sobem sozinhos
 * quando a internet volta (e, no Android, até com o app fechado, pelo
 * service worker). Os sem pedido pedem a confirmação do cliente.
 */
export function EnviosGuardados() {
  const router = useRouter();
  const [lista, setLista] = useState<EnvioPendente[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [terminar, setTerminar] = useState<EnvioPendente | null>(null);

  const recarregar = useCallback(async () => setLista(await enviosGuardados()), []);

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine) return;
    const pend = (await enviosGuardados()).filter((p) => p.itemId && p.empresaId && p.tipoId);
    if (!pend.length) return recarregar();
    setSubindo(true);
    for (const p of pend) {
      const ini = await api<{ uploadId: string; url: string; cabecalhos: Record<string, string> }>('/api/envios/iniciar', 'POST', { nomeOriginal: p.nome, mime: p.mime, itemId: p.itemId }, p.token);
      if (!ini.ok) { if (ini.erro !== 'sem-rede') await marcarErro(p.id, ini.erro ?? 'erro'); continue; }
      if (!(await enviarBytes(ini.url, ini.cabecalhos, p.arquivo))) continue;
      const an = await api(`/api/envios/${ini.uploadId}/analisar`, 'POST', { sensivel: p.sensivel }, p.token);
      if (!an.ok) { await marcarErro(p.id, an.erro ?? 'erro'); continue; }
      const c = await api(`/api/envios/${ini.uploadId}/confirmar`, 'POST', { empresaId: p.empresaId, tipoId: p.tipoId, subtipoId: p.subtipoId, competencia: null }, p.token);
      if (c.ok) await removerEnvio(p.id); else await marcarErro(p.id, c.erro ?? 'erro');
    }
    setSubindo(false);
    await recarregar();
    router.refresh();
  }, [recarregar, router]);

  useEffect(() => {
    recarregar().then(sincronizar);
    const aoVoltar = () => sincronizar();
    const doSw = (e: MessageEvent) => { if (e.data?.tipo === 'sincronizar-envios' || e.data?.tipo === 'envios-sincronizados') { recarregar(); router.refresh(); } };
    window.addEventListener('online', aoVoltar);
    navigator.serviceWorker?.addEventListener('message', doSw);
    return () => { window.removeEventListener('online', aoVoltar); navigator.serviceWorker?.removeEventListener('message', doSw); };
  }, [recarregar, sincronizar, router]);

  if (!lista.length) return null;
  return (
    <section className="card p-4 flex flex-col gap-2" aria-label="Envios guardados no aparelho">
      <div className="flex items-center gap-2"><CloudOff size={16} className="text-fg-3" /><span className="h3 flex-1">{lista.length} envio{lista.length > 1 ? 's' : ''} guardado{lista.length > 1 ? 's' : ''} no aparelho</span>
        <button className="btn btn-sm" onClick={sincronizar} disabled={subindo}><RefreshCw size={13} />{subindo ? 'Enviando…' : 'Enviar agora'}</button></div>
      {!temSincronizacaoEmSegundoPlano() && <p className="text-[12.5px] text-fg-3">Abra o app para terminar o envio quando estiver com internet.</p>}
      {lista.map((p) => (
        <div key={p.id} className="linha" style={{ minHeight: 48 }}>
          <span className="flex-1 min-w-0"><div className="linha-titulo truncate text-[13px]">{p.titulo}</div><div className="linha-sub truncate">{p.erro ?? p.nome}</div></span>
          {!p.itemId && <button className="btn btn-sm" onClick={() => setTerminar(p)}>Terminar</button>}
        </div>
      ))}
      {terminar && <FluxoEnvioDeGuardado p={terminar} aoFechar={async () => { setTerminar(null); await recarregar(); }} />}
    </section>
  );
}

function FluxoEnvioDeGuardado({ p, aoFechar }: { p: EnvioPendente; aoFechar: () => void }) {
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; cnpj: string }[] | null>(null);
  useEffect(() => { fetch('/api/cliente/empresas').then((r) => r.json()).then((j) => setEmpresas(j.empresas ?? [])); }, []);
  if (!empresas) return null;
  return <FluxoEnvio fonte="arquivo" arquivoInicial={new File([p.arquivo], p.nome, { type: p.mime })} item={null} empresas={empresas} token={p.token}
    aoTerminar={() => removerEnvio(p.id)} aoFechar={aoFechar} />;
}
