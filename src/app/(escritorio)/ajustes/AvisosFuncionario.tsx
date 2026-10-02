'use client';
import { useState } from 'react';
import { AtivarAvisos } from '@/components/pwa/AtivarAvisos';
import { chamar } from '@/components/ui/cliente-http';

/** Push e notificação no computador quando chega arquivo para conferir; resumo diário por e-mail. */
export function AvisosFuncionario({ resumoDiario }: { resumoDiario: boolean }) {
  const [resumo, setResumo] = useState(resumoDiario);
  return (
    <div className="flex flex-col gap-3">
      <AtivarAvisos paraFuncionario />
      <label className="card p-4 flex items-center justify-between gap-3 text-[13.5px]">
        Resumo diário por e-mail (o que pede ação nas suas empresas)
        <input type="checkbox" className="sw" checked={resumo} onChange={async (e) => { setResumo(e.target.checked); await chamar('/api/usuarios/eu', 'PATCH', { resumoDiario: e.target.checked }); }} />
      </label>
    </div>
  );
}
