import Link from 'next/link';
import { ClipboardCheck, CalendarDays, Settings, ChevronRight } from 'lucide-react';

export const metadata = { title: 'Mais' };
/** Celular: o que não cabe na barra de abas. */
export default function Mais() {
  const itens = [
    { href: '/conferir', rotulo: 'A conferir', sub: 'Arquivos que chegaram e esperam conferência', Icone: ClipboardCheck },
    { href: '/agenda', rotulo: 'Agenda', sub: 'Pedidos recorrentes por perfil de empresa', Icone: CalendarDays },
    { href: '/ajustes', rotulo: 'Ajustes', sub: 'Tipos, mensagens, estética, usuários', Icone: Settings },
  ];
  return (
    <div>
      <h1 className="titulo-pagina mb-4">Mais</h1>
      <div className="lista">
        {itens.map(({ href, rotulo, sub, Icone }) => (
          <Link key={href} href={href} className="linha">
            <span className="icone-id neutro"><Icone /></span>
            <span className="flex-1 min-w-0"><div className="linha-titulo">{rotulo}</div><div className="linha-sub">{sub}</div></span>
            <ChevronRight size={16} className="text-fg-4" />
          </Link>
        ))}
      </div>
    </div>
  );
}
