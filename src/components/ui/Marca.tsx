import { FolderOpen } from 'lucide-react';

/** A marca lê var(--destaque): segue a paleta do funcionário; nas rotas públicas fica dourada. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  const nome = process.env.NEXT_PUBLIC_ESCRITORIO_NOME || 'Documentos';
  return (
    <span className="inline-flex items-center gap-2.5 min-w-0">
      <span className="icone-id" aria-hidden><FolderOpen /></span>
      {!compacta && <span className="serif font-bold text-[15px] tracking-tight truncate">{nome}</span>}
    </span>
  );
}
