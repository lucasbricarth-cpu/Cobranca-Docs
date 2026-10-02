'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Bell, MessageCircle, Shield } from 'lucide-react';
import { chamar } from '@/components/ui/cliente-http';
import { useToast } from '@/components/ui/Toast';

interface Item { chave: string; canal: 'email' | 'push' | 'whatsapp' | 'portal'; descricao: string; padrao: string; atual: string | null }
const ICONE = { email: Mail, push: Bell, whatsapp: MessageCircle, portal: Shield };
const NOME = { email: 'E-mail', push: 'Push', whatsapp: 'WhatsApp', portal: 'Portal' };

export function Mensagens({ itens }: { itens: Item[] }) {
  const router = useRouter();
  const [toast, avisar] = useToast();
  const [canal, setCanal] = useState<Item['canal']>('push');
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const lista = itens.filter((i) => i.canal === canal);
  async function salvar(i: Item) {
    const r = await chamar('/api/mensagens', 'PUT', { chave: i.chave, texto: rascunho[i.chave] ?? i.atual ?? i.padrao });
    if (!r.ok) return avisar(r.erro ?? 'Erro', 'erro');
    avisar('Salvo.'); router.refresh();
  }
  async function restaurar(i: Item) {
    await chamar('/api/mensagens', 'PUT', { chave: i.chave, texto: '' });
    setRascunho((r) => { const n = { ...r }; delete n[i.chave]; return n; });
    avisar('Voltou ao texto padrão.'); router.refresh();
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="seg self-start">
        {(['push', 'email', 'whatsapp', 'portal'] as const).map((c) => { const I = ICONE[c]; return <button key={c} className={`seg-item ${canal === c ? 'active' : ''}`} onClick={() => setCanal(c)}><I size={13} />{NOME[c]}</button>; })}
      </div>
      {lista.map((i) => {
        const valor = rascunho[i.chave] ?? i.atual ?? i.padrao;
        const vars = [...new Set((i.padrao.match(/\{\w+\}/g) ?? []))];
        return (
          <section key={i.chave} className="card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2"><span className="h3 flex-1">{i.descricao}</span>{i.atual !== null && <span className="pill pill-gold">Editado</span>}</div>
            <textarea className="input" rows={i.canal === 'email' || i.canal === 'portal' ? 6 : 3} value={valor} onChange={(e) => setRascunho({ ...rascunho, [i.chave]: e.target.value })} aria-label={i.descricao} />
            {vars.length > 0 && <div className="text-[11.5px] text-fg-3">Variáveis: <span className="mono">{vars.join(' ')}</span></div>}
            <div className="flex gap-2 justify-end">
              {i.atual !== null && <button className="btn btn-sm btn-ghost" onClick={() => restaurar(i)}>Voltar ao padrão</button>}
              <button className="btn btn-sm btn-primary" onClick={() => salvar(i)} disabled={valor === (i.atual ?? i.padrao)}>Salvar</button>
            </div>
          </section>
        );
      })}
      {toast}
    </div>
  );
}
