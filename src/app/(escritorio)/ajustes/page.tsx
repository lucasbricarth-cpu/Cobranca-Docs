import Link from 'next/link';
import { Palette, FileText, MessageCircle, Users, Shield, ChevronRight, Sparkles, Database } from 'lucide-react';
import { exigirFuncionario } from '@/lib/auth/sessao';

export const metadata = { title: 'Ajustes' };
export default async function Ajustes() {
  const s = await exigirFuncionario();
  const itens = [
    { href: '/ajustes/estetica', rotulo: 'Estética', sub: 'Cor de destaque, fundo, vidro e tema claro/escuro', Icone: Palette, admin: false },
    { href: '/ajustes/tipos', rotulo: 'Tipos de documento', sub: 'Nome, subtipo, regra de mês, sensível, prazo de guarda', Icone: FileText, admin: true },
    { href: '/ajustes/classificacao', rotulo: 'Classificação', sub: 'Arquivamento automático por tipo e taxa de acerto', Icone: Sparkles, admin: true },
    { href: '/ajustes/mensagens', rotulo: 'Mensagens', sub: 'Textos de push, e-mail e WhatsApp', Icone: MessageCircle, admin: true },
    { href: '/ajustes/usuarios', rotulo: 'Usuários', sub: 'Funcionários, papéis e responsáveis', Icone: Users, admin: true },
    { href: '/ajustes/dominio', rotulo: 'Leitor da Domínio', sub: 'Último envio e diagnóstico inicial', Icone: Database, admin: true },
    { href: '/ajustes/guarda', rotulo: 'Guarda e exclusões', sub: 'Documentos vencidos esperando aprovação', Icone: Shield, admin: true },
  ].filter((i) => !i.admin || s.papel === 'admin');
  return (
    <div>
      <h1 className="titulo-pagina mb-4">Ajustes</h1>
      <div className="lista max-w-[640px]">
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
