'use client';

import { useState } from 'react';
import { CascaEscritorio } from '@/components/cascas/CascaEscritorio';
import { CascaCliente } from '@/components/cascas/CascaCliente';
import { Pilula } from '@/components/ui/Pilula';
import { Progresso } from '@/components/ui/Progresso';

/**
 * Página de demonstração: a chave "Escritório / Cliente" existe SÓ aqui,
 * para comparar as duas pontas lado a lado. Nunca no app real (prompt §1).
 */
export default function Demo() {
  const [ponta, setPonta] = useState<'escritorio' | 'cliente'>('escritorio');
  const Conteudo = (
    <div>
      <div className="seg mb-4">
        <button type="button" className={`seg-item ${ponta === 'escritorio' ? 'active' : ''}`} onClick={() => setPonta('escritorio')}>Escritório</button>
        <button type="button" className={`seg-item ${ponta === 'cliente' ? 'active' : ''}`} onClick={() => setPonta('cliente')}>Cliente</button>
      </div>
      <h1 className="titulo-pagina mb-3">{ponta === 'escritorio' ? 'Padaria do Bairro' : 'Setembro 2026'}</h1>
      <div className="card p-4 mb-4"><Progresso recebidos={7} conferidos={5} total={9} /></div>
      <div className="lista">
        {([
          ['Extrato Itaú final 0567', 'Conferido · chegou em 03/10 pelo WhatsApp', 'conferido'],
          ['Extrato Sicredi final 0921', 'Falta · lembrete enviado em 05/10', 'pendente'],
          ['Fatura cartão final 3310', 'Prazo 05/10', 'atrasado'],
          ['Notas fiscais de saída', 'Chegou em 02/10 pelo app', 'recebido'],
          ['Guia FGTS', 'A foto ficou ilegível. Envie de novo, por favor.', 'refazer'],
          ['Extrato BB final 1200 (v1)', 'Substituído em 04/10', 'substituido'],
        ] as const).map(([t, s, st]) => (
          <div key={t} className="linha">
            <span className="flex-1 min-w-0"><div className="linha-titulo">{t}</div><div className="linha-sub">{s}</div></span>
            <Pilula status={st} />
          </div>
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="linha"><span className="flex-1"><div className="linha-titulo">Linha longa {i + 1}</div><div className="linha-sub">Para testar a rolagem até o fim com as barras</div></span><Pilula status="pendente" /></div>
        ))}
        <div className="linha" data-teste="ultima"><span className="flex-1"><div className="linha-titulo">Última linha</div><div className="linha-sub">Precisa ficar inteira acima da barra de abas</div></span><Pilula status="conferido" /></div>
      </div>
    </div>
  );
  return ponta === 'escritorio'
    ? <CascaEscritorio nome="Ana (demo)" papel="admin" titulo="Demonstração" contadores={{ conferir: 3 }}>{Conteudo}</CascaEscritorio>
    : <CascaCliente titulo="Demonstração" pendentes={2}>{Conteudo}</CascaCliente>;
}
