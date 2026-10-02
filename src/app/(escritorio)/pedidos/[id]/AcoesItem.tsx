'use client';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';

export function AcoesItem({ itemId, podeCancelar }: { itemId: string; podeCancelar: boolean }) {
  const router = useRouter();
  if (!podeCancelar) return null;
  return (
    <button className="btn btn-ghost btn-icon" aria-label="Cancelar item" title="Cancelar este item" onClick={async () => {
      if (!confirm('Cancelar este item? Ele sai do checklist e os lembretes param.')) return;
      await chamar(`/api/itens/${itemId}`, 'PATCH', { cancelar: true });
      router.refresh();
    }}><X size={15} /></button>
  );
}
