import Link from 'next/link';
import { Eye, Download, Archive, Search } from 'lucide-react';
import { exigirAdmin } from '@/lib/auth/sessao';
import { registroDeAcesso } from '@/lib/documentos/consultas';
import { todos } from '@/lib/db';
import { uuidOuNada } from '@/lib/url';
import { dataCurta, horaSP } from '@/lib/tempo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registro de acesso' };

const ACOES = { abrir: ['abriu', Eye], baixar: ['baixou', Download], exportar: ['exportou', Archive], miniatura: ['viu a miniatura', Eye] } as const;

/** Quem abriu ou baixou cada arquivo, e quando (Etapa 9). Só Admin. */
export default async function PaginaRegistro({ searchParams }: { searchParams: { empresa?: string; quem?: string; desde?: string } }) {
  await exigirAdmin();
  const empresaId = uuidOuNada(searchParams.empresa) ?? null;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.desde ?? '') ? searchParams.desde! : null;
  const quem = (searchParams.quem ?? '').slice(0, 80) || null;
  const [linhas, empresas] = await Promise.all([
    registroDeAcesso({ empresaId, quem, desde, limite: 300 }),
    todos<{ id: string; nome: string }>(`SELECT id, nome FROM empresas ORDER BY nome`),
  ]);
  return (
    <div className="max-w-[960px] flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina mb-1">Registro de acesso</h1>
        <p className="text-[13px] text-fg-3">Quem abriu, baixou ou exportou cada arquivo, e quando. Cada documento também mostra o seu registro no painel lateral.</p>
      </div>
      <form className="card p-3 flex gap-2 flex-wrap items-end" method="get">
        <div className="campo flex-1 min-w-[200px]"><label className="label" htmlFor="rg-emp">Empresa</label>
          <select id="rg-emp" name="empresa" className="input" defaultValue={empresaId ?? ''}>
            <option value="">Todas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select></div>
        <div className="campo flex-1 min-w-[160px]"><label className="label" htmlFor="rg-quem">Pessoa</label>
          <input id="rg-quem" name="quem" className="input" defaultValue={quem ?? ''} placeholder="Nome" /></div>
        <div className="campo min-w-[150px]"><label className="label" htmlFor="rg-desde">Desde</label>
          <input id="rg-desde" name="desde" type="date" className="input" defaultValue={desde ?? ''} /></div>
        <button className="btn" type="submit"><Search size={14} />Filtrar</button>
      </form>
      {linhas.length ? (
        <div className="lista">
          {linhas.map((l) => {
            const [verbo, Icone] = ACOES[l.acao] ?? ACOES.abrir;
            const corpo = (
              <>
                <span className="icone-id neutro"><Icone /></span>
                <span className="flex-1 min-w-0">
                  <div className="linha-titulo truncate"><b>{l.quem}</b>{l.lado === 'cliente' ? ' (cliente)' : ''} {verbo} {l.documento}</div>
                  <div className="linha-sub truncate">{l.empresa_nome ?? 'Pasta geral'}</div>
                </span>
                <span className="mono text-[12px] text-fg-3 whitespace-nowrap">{dataCurta(l.em, true)} {horaSP(l.em)}</span>
              </>
            );
            return l.empresa_id && !l.excluido
              ? <Link key={l.id} href={`/clientes/${l.empresa_id}?aba=arquivo&doc=${l.documento_id}`} className="linha">{corpo}</Link>
              : <div key={l.id} className="linha">{corpo}</div>;
          })}
        </div>
      ) : <div className="vazio">Nenhum acesso com esses filtros.</div>}
    </div>
  );
}
