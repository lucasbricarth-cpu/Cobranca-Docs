'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Check } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { Modal } from '@/components/ui/Modal';
import { dataCurta, horaSP } from '@/lib/tempo';

interface Situacao {
  documentos: number; exportacaoAtual: boolean; arquivos: number | null; exportadaEm: string | null; exportadaPor: string | null;
  ultimoRecebido: string | null; saidaEm: string | null;
}

export function Saida({ empresaId, cnpj, situacao: s }: { empresaId: string; cnpj: string; situacao: Situacao }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [digitado, setDigitado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const digitos = (x: string) => x.replace(/\D/g, '');

  function exportar() {
    setExportando(true);
    // Download direto (o ZIP vem em fluxo); a situação atualiza quando ele termina.
    window.location.href = `/api/empresas/${empresaId}/exportar`;
    setTimeout(() => { setExportando(false); router.refresh(); }, 4000);
  }
  async function excluir() {
    setErro(null);
    const r = await chamar<{ excluidos: number }>(`/api/empresas/${empresaId}/saida`, 'POST', { confirmacao: digitado });
    if (!r.ok) return setErro(r.erro ?? 'Erro');
    setConfirmar(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="icone-id"><Download /></span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">1. Exportar tudo</div>
            <p className="text-[12.5px] text-fg-3">Um ZIP com a mesma árvore de pastas do portal (Tipo › Subtipo › Mês), as versões anteriores e um índice em planilha. Inclui os sensíveis. Fica no registro de acesso.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn btn-primary" onClick={exportar} disabled={exportando || !s.documentos}><Download size={15} />{exportando ? 'Gerando…' : `Exportar tudo (${s.documentos})`}</button>
          {s.exportadaEm && (
            <span className={`pill pill-dot ${s.exportacaoAtual ? 'pill-ok' : 'pill-warn'}`}>
              {s.exportacaoAtual ? 'Exportado' : 'Chegou arquivo depois da exportação'} · {dataCurta(s.exportadaEm, true)} {horaSP(new Date(s.exportadaEm))}{s.exportadaPor ? ` · ${s.exportadaPor}` : ''}
            </span>
          )}
        </div>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="icone-id neutro"><Trash2 /></span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">2. Excluir os documentos</div>
            <p className="text-[12.5px] text-fg-3">Só depois de exportar tudo. Apaga os arquivos e as miniaturas da empresa e cancela os pedidos abertos. O cadastro, os acessos e o histórico de exclusões ficam.</p>
          </div>
        </div>
        {s.saidaEm && <span className="pill pill-dot pill-ok self-start"><Check size={12} />Documentos excluídos em {dataCurta(s.saidaEm, true)}</span>}
        <button className="btn self-start" disabled={!s.exportacaoAtual || !s.documentos} onClick={() => { setDigitado(''); setErro(null); setConfirmar(true); }}>
          <Trash2 size={15} />Aprovar exclusão
        </button>
        {!s.exportacaoAtual && s.documentos > 0 && <p className="text-[12px] text-fg-4">Liberado depois de uma exportação completa, feita depois do último arquivo recebido.</p>}
      </section>

      <Modal aberto={confirmar} aoFechar={() => setConfirmar(false)} titulo="Excluir todos os documentos" icone={<Trash2 />}
        subtitulo={`${s.documentos} arquivo(s). Não tem volta.`}
        rodape={<><button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button><button className="btn btn-primary" disabled={digitos(digitado) !== digitos(cnpj)} onClick={excluir}>Excluir de vez</button></>}>
        <div className="campo">
          <label className="label" htmlFor="sd-cnpj">Para confirmar, digite o CNPJ <span className="mono">{cnpj}</span></label>
          <input id="sd-cnpj" className="input mono" inputMode="numeric" autoComplete="off" value={digitado} onChange={(e) => setDigitado(e.target.value)} />
        </div>
        {erro && <div className="pill pill-danger pill-dot mt-3">{erro}</div>}
      </Modal>
    </div>
  );
}
