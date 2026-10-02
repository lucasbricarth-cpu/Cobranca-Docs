'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Home, Users, Inbox, ClipboardCheck, CalendarDays, Settings, MoreHorizontal, LogOut } from 'lucide-react';
import { useBackgroundPrefs } from '@/components/design/BackgroundPrefsProvider';
import { Marca } from '@/components/ui/Marca';

/**
 * Casca do funcionário. Uma única árvore de conteúdo; o layout muda só por CSS.
 * Computador: modelo A, barra lateral em grupos. Celular: cabeçalho e barra
 * de abas (Início, Clientes, Pedidos, Mais). Nenhuma barra cobre conteúdo:
 * o cabeçalho é sticky (ocupa o próprio espaço) e o conteúdo reserva a
 * altura da tabbar mais a área do gesto do iPhone.
 */
export interface Contadores { conferir?: number; naoReconhecidos?: number; atrasados?: number }

type Item = { href: string; rotulo: string; Icone: typeof Home; contador?: keyof Contadores };
const GRUPOS: { titulo: string; itens: Item[] }[] = [
  { titulo: 'Trabalho', itens: [
    { href: '/inicio', rotulo: 'Início', Icone: Home },
    { href: '/clientes', rotulo: 'Clientes', Icone: Users },
    { href: '/pedidos', rotulo: 'Pedidos', Icone: Inbox },
    { href: '/conferir', rotulo: 'A conferir', Icone: ClipboardCheck, contador: 'conferir' },
  ] },
  { titulo: 'Rotina', itens: [
    { href: '/agenda', rotulo: 'Agenda', Icone: CalendarDays },
    { href: '/ajustes', rotulo: 'Ajustes', Icone: Settings },
  ] },
];
const ABAS: Item[] = [
  { href: '/inicio', rotulo: 'Início', Icone: Home },
  { href: '/clientes', rotulo: 'Clientes', Icone: Users },
  { href: '/pedidos', rotulo: 'Pedidos', Icone: Inbox },
  { href: '/mais', rotulo: 'Mais', Icone: MoreHorizontal, contador: 'conferir' },
];

export function CascaEscritorio({ children, nome, papel, contadores = {}, titulo }: { children: ReactNode; nome: string; papel: string; contadores?: Contadores; titulo?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { esquecer } = useBackgroundPrefs();
  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === '/mais' && ['/conferir', '/agenda', '/ajustes', '/mais'].some((p) => pathname.startsWith(p)));

  async function sair() {
    await fetch('/api/auth/sair', { method: 'POST' });
    esquecer();
    router.push('/entrar');
  }

  return (
    <div className="casca">
      <aside className="app-sidebar so-pc" aria-label="Navegação">
        <div className="app-sidebar-head"><Marca /></div>
        <nav className="app-sidebar-nav">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <div className="nav-grupo">{g.titulo}</div>
              {g.itens.map(({ href, rotulo, Icone, contador }) => {
                const n = contador ? contadores[contador] : undefined;
                return (
                  <Link key={href} href={href} className={`app-nav-item ${ativo(href) ? 'active' : ''}`} aria-current={ativo(href) ? 'page' : undefined}>
                    <Icone className="icn" aria-hidden />
                    {rotulo}
                    {n ? <span className="nav-contador">{n}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="app-sidebar-foot">
          <div className="px-2.5 py-1.5">
            <div className="text-[13px] font-medium truncate">{nome}</div>
            <div className="text-[11px] text-fg-4 capitalize">{papel}</div>
          </div>
          <button className="app-nav-item" onClick={sair}><LogOut className="icn" aria-hidden />Sair</button>
        </div>
      </aside>

      <header className="casca-m-topo so-cel">
        {titulo ? <><Marca compacta /><span className="h2 truncate">{titulo}</span></> : <Marca />}
      </header>

      <main className="casca-main">
        {titulo ? <header className="casca-topo so-pc"><span className="h2">{titulo}</span></header> : null}
        <div className="casca-conteudo">{children}</div>
      </main>

      <nav className="tabbar so-cel" aria-label="Abas">
        {ABAS.map(({ href, rotulo, Icone, contador }) => {
          const n = contador ? contadores[contador] : undefined;
          return (
            <Link key={href} href={href} className={`tabbar-item ${ativo(href) ? 'active' : ''}`} aria-current={ativo(href) ? 'page' : undefined}>
              <Icone aria-hidden />
              {rotulo}
              {n ? <span className="tabbar-badge">{n}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
