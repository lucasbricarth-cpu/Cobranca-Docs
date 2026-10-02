import { exigirAdmin } from '@/lib/auth/sessao';
import { todos } from '@/lib/db';
import { TEXTOS_PADRAO } from '@/lib/notificacoes/textos';
import { Mensagens } from './Mensagens';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mensagens' };

export default async function PaginaMensagens() {
  await exigirAdmin();
  const salvas = Object.fromEntries((await todos<{ chave: string; texto: string }>(`SELECT chave, texto FROM mensagens`)).map((m) => [m.chave, m.texto]));
  const itens = [
    ...Object.entries(TEXTOS_PADRAO).map(([chave, t]) => ({ chave, canal: t.canal, descricao: t.descricao, padrao: t.texto, atual: salvas[chave] ?? null })),
    { chave: 'privacidade.texto', canal: 'portal' as const, descricao: 'Aviso de privacidade no portal do cliente', padrao: '', atual: salvas['privacidade.texto'] ?? null },
  ];
  return (
    <div className="max-w-[860px]">
      <h1 className="titulo-pagina mb-1">Mensagens</h1>
      <p className="text-[13px] text-fg-3 mb-5">Textos de push, e-mail e WhatsApp. As variáveis vão entre chaves, como {'{nome}'} e {'{link}'}. Os avisos nunca mostram o conteúdo do documento, o banco nem o valor.</p>
      <Mensagens itens={itens} />
    </div>
  );
}
