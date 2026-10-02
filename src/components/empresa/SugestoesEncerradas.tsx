'use client';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';

/** "Conta encerrada na Domínio. Parar de pedir?" — quem confirma é o funcionário; o app nunca desativa sozinho. */
export function SugestoesEncerradas({ subtipos }: { subtipos: { id: string; rotulo: string }[] }) {
  const router = useRouter();
  if (!subtipos.length) return null;
  return (
    <div className="flex flex-col gap-2 mb-3">
      {subtipos.map((x) => (
        <div key={x.id} className="card p-3 flex items-center gap-3 flex-wrap" style={{ borderColor: 'rgba(230,180,80,.35)' }}>
          <AlertTriangle size={16} className="text-[var(--warn-text)]" aria-hidden />
          <span className="flex-1 text-[13px]"><b>{x.rotulo}</b>: conta encerrada na Domínio. Parar de pedir?</span>
          <button className="btn btn-sm" onClick={async () => { await chamar(`/api/subtipos/${x.id}`, 'PATCH', { manterConta: true }); router.refresh(); }}>Continuar pedindo</button>
          <button className="btn btn-sm btn-primary" onClick={async () => { await chamar(`/api/subtipos/${x.id}`, 'PATCH', { ativo: false }); router.refresh(); }}>Parar de pedir</button>
        </div>
      ))}
    </div>
  );
}
