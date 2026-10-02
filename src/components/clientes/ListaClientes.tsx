import Link from 'next/link';
import { Search } from 'lucide-react';
import { formatarCnpj } from '@/lib/texto';
import type { LinhaEmpresa } from '@/lib/consultas/empresas';
import { Progresso } from '@/components/ui/Progresso';

/** Lista de clientes: busca por nome ou CNPJ e filtro por responsável. Usada na tela cheia e na coluna esquerda. */
export function ListaClientes({ empresas, busca, responsavel, funcionarios, ativoId, compacta = false, meuId }: {
  empresas: LinhaEmpresa[]; busca?: string; responsavel?: string; funcionarios: { id: string; nome: string }[]; ativoId?: string; compacta?: boolean; meuId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-2" action="/clientes">
        <div className="input-group">
          <span className="input-icon"><Search size={15} /></span>
          <input className="input input-search" name="q" defaultValue={busca} placeholder="Buscar por nome ou CNPJ" aria-label="Buscar cliente" />
        </div>
        <div className="chips">
          <a className={`chip ${!responsavel ? 'active' : ''}`} href={`/clientes${busca ? `?q=${encodeURIComponent(busca)}` : ''}`}>Todos</a>
          <a className={`chip ${responsavel === meuId ? 'active' : ''}`} href={`/clientes?resp=${meuId}${busca ? `&q=${encodeURIComponent(busca)}` : ''}`}>Meus</a>
          {!compacta && funcionarios.filter((f) => f.id !== meuId).map((f) => (
            <a key={f.id} className={`chip ${responsavel === f.id ? 'active' : ''}`} href={`/clientes?resp=${f.id}`}>{f.nome.split(' ')[0]}</a>
          ))}
        </div>
      </form>
      <div className="lista">
        {empresas.length === 0 && <div className="vazio">Nenhum cliente encontrado.</div>}
        {empresas.map((e) => (
          <Link key={e.id} href={`/clientes/${e.id}`} className={`linha ${ativoId === e.id ? 'is-on' : ''}`} aria-current={ativoId === e.id ? 'page' : undefined}>
            <span className="flex-1 min-w-0">
              <div className="linha-titulo truncate">{e.nome}</div>
              <div className="linha-sub truncate"><span className="mono">{formatarCnpj(e.cnpj)}</span>{e.responsavel ? ` · ${e.responsavel}` : ''}</div>
              {e.total > 0 && !compacta && <div className="mt-2"><Progresso recebidos={e.recebidos} conferidos={e.conferidos} total={e.total} compacta /></div>}
            </span>
            {e.atrasados > 0 && <span className="pill st-atrasado">{e.atrasados} atrasado{e.atrasados > 1 ? 's' : ''}</span>}
            {!e.ativo && <span className="pill">Inativa</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
