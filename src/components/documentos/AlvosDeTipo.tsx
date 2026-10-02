'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconeTipo } from '@/components/ui/IconeTipo';
import { ClassificarModal, type OpcoesClassificar } from './ClassificarModal';
import { useToast } from '@/components/ui/Toast';

/**
 * No computador, o funcionário arrasta o arquivo para o tipo certo; o modal
 * Classificar abre já com o tipo, para escolher subtipo e mês.
 */
export function AlvosDeTipo({ tipos, empresas, competencia }: {
  tipos: { id: string; nome: string; icone: string; sensivel: boolean; subtipo_origem: string | null }[];
  empresas?: { id: string; nome: string }[]; competencia: string;
}) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [sobre, setSobre] = useState<string | null>(null);
  const [abrir, setAbrir] = useState<OpcoesClassificar | null>(null);
  return (
    <>
      <div className="so-pc eyebrow mb-2">Arraste um arquivo para o tipo</div>
      <div className="so-pc grade mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
        {tipos.map((t) => (
          <div key={t.id} className="cartao-tipo" style={{ minHeight: 64, ...(sobre === t.id ? { borderColor: 'var(--gold-line)', background: 'var(--glass-3)' } : {}) }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-documento')) { e.preventDefault(); setSobre(t.id); } }}
            onDragLeave={() => setSobre(null)}
            onDrop={(e) => {
              e.preventDefault(); setSobre(null);
              const d = JSON.parse(e.dataTransfer.getData('application/x-documento'));
              setAbrir({ documentoId: d.id, empresaId: d.empresaId, tipoId: t.id, competencia, nome: d.nome });
            }}>
            <span className="flex items-center gap-2 text-[12.5px] font-medium"><IconeTipo nome={t.icone} sensivel={t.sensivel} size={15} />{t.nome}</span>
          </div>
        ))}
      </div>
      <ClassificarModal abrir={abrir} aoFechar={() => setAbrir(null)} tipos={tipos} empresas={empresas}
        aoSalvar={(m) => { setAbrir(null); avisar(m); router.refresh(); }} />
      {toast}
    </>
  );
}
