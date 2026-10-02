'use client';

import type { ArquivoDaLista } from '@/lib/documentos/consultas';
import { nomeDoMes } from '@/lib/tempo';
import { LinhaArquivo } from './LinhaArquivo';

/** Lista corrida, separada por mês, com o cabeçalho do mês fixo ao rolar. */
/** hrefDoc é um modelo de URL com __DOC__ no lugar do id (funções não atravessam do servidor para o cliente). */
export function ListaPorMes({ arquivos, hrefDoc, docAtivo, arrastavel, mostrarEmpresa }: {
  arquivos: ArquivoDaLista[]; hrefDoc: string; docAtivo?: string; arrastavel?: boolean; mostrarEmpresa?: boolean;
}) {
  if (!arquivos.length) return <div className="vazio">Nenhum arquivo aqui.</div>;
  const grupos = new Map<string, ArquivoDaLista[]>();
  for (const a of arquivos) {
    const k = a.competencia ?? 'sem';
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  return (
    <div className="flex flex-col gap-2">
      {[...grupos.entries()].map(([mes, lista]) => (
        <section key={mes} aria-label={mes === 'sem' ? 'Sem mês' : nomeDoMes(mes)}>
          <h3 className="mes-cab">{mes === 'sem' ? 'Sem mês' : nomeDoMes(mes)}</h3>
          <div className="lista mt-1">
            {lista.map((a) => <LinhaArquivo key={a.id} a={a} href={hrefDoc.replace('__DOC__', a.id)} ativo={docAtivo === a.id} arrastavel={arrastavel && (a.status === 'nao_reconhecido' || a.status === 'a_conferir')} mostrarEmpresa={mostrarEmpresa} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
