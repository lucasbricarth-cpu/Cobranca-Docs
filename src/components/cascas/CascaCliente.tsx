'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ListChecks, FolderOpen, Camera, CircleUser } from 'lucide-react';
import { Marca } from '@/components/ui/Marca';

/**
 * Casca do cliente (celular primeiro): abas Pendentes, Enviados e Enviar.
 * No computador, uma coluna central com a mesma ordem. Sempre Dourado
 * (rota pública para a paleta). A tabbar reserva o próprio espaço.
 */
const ABAS = [
  { href: '/cliente', rotulo: 'Pendentes', Icone: ListChecks },
  { href: '/cliente/enviados', rotulo: 'Enviados', Icone: FolderOpen },
  { href: '/cliente/enviar', rotulo: 'Enviar', Icone: Camera },
];

export function CascaCliente({ children, titulo, pendentes }: { children: ReactNode; titulo?: string; pendentes?: number }) {
  const pathname = usePathname();
  const ativo = (href: string) => (href === '/cliente' ? pathname === '/cliente' || pathname.startsWith('/cliente/item') : pathname.startsWith(href));
  return (
    <div className="casca-cli">
      <header className="casca-m-topo">
        {titulo ? <><Marca compacta /><span className="h2 truncate">{titulo}</span></> : <Marca />}
        <Link href="/cliente/conta" className="btn btn-ghost btn-icon ml-auto" aria-label="Minha conta" style={{ width: 40, height: 40 }}><CircleUser size={20} /></Link>
      </header>
      <main className="casca-cli-conteudo">{children}</main>
      <nav className="tabbar tabbar-cli" aria-label="Abas">
        {ABAS.map(({ href, rotulo, Icone }) => (
          <Link key={href} href={href} className={`tabbar-item ${ativo(href) ? 'active' : ''}`} aria-current={ativo(href) ? 'page' : undefined}>
            <Icone aria-hidden />
            {rotulo}
            {href === '/cliente' && pendentes ? <span className="tabbar-badge">{pendentes}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
