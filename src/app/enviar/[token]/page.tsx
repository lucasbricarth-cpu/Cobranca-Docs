import { atorDoLink } from '@/lib/envio/ator';
import { um } from '@/lib/db';
import { nomeDoSubtipo } from '@/lib/documentos/nomes';
import { nomeDoMes } from '@/lib/tempo';
import { Marca } from '@/components/ui/Marca';
import { BotoesEnvio } from '@/components/envio/BotoesEnvio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enviar documento', robots: { index: false } };

/**
 * Link de envio (QR code do computador, botão "Enviar pelo app" do WhatsApp):
 * abre SÓ o envio daquele pedido. Histórico e pasta pedem a entrada com a
 * passkey, porque a mensagem pode ser encaminhada.
 */
export default async function EnviarPorLink({ params }: { params: { token: string } }) {
  const ator = await atorDoLink(params.token);
  const casca = (conteudo: React.ReactNode) => (
    <main className="min-h-dvh flex flex-col">
      <header className="casca-m-topo"><Marca /></header>
      <div className="p-4 max-w-[560px] w-full mx-auto flex flex-col gap-4">{conteudo}</div>
    </main>
  );
  if (!ator) return casca(<div className="vazio">Este link expirou ou já não vale. Abra o app para enviar, ou peça um novo link ao escritório.</div>);
  const empresa = ator.empresas[0];
  const item = ator.escopo?.itemId ? await um<Record<string, unknown>>(
    `SELECT i.id, i.tipo_id, i.subtipo_id, i.status, to_char(i.competencia, 'YYYY-MM-DD') AS competencia, t.nome AS tipo_nome, t.sensivel,
            s.nome AS sub_nome, s.cartao_final, s.cartao_emissor, cb.codigo_banco, cb.nome_banco, cb.final AS conta_final
     FROM itens_pedido i JOIN tipos_documento t ON t.id = i.tipo_id LEFT JOIN subtipos s ON s.id = i.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     WHERE i.id = $1`, [ator.escopo.itemId]) : null;
  const sub = item ? nomeDoSubtipo({ nome: item.sub_nome as string, cartao_final: item.cartao_final as string, cartao_emissor: item.cartao_emissor as string, codigo_banco: item.codigo_banco as string, nome_banco: item.nome_banco as string, conta_final: item.conta_final as string }) : '';
  const titulo = item ? `${item.tipo_nome}${sub ? ` ${sub}` : ''}` : 'Documento';
  const aberto = !item || item.status === 'pendente' || item.status === 'refazer';
  return casca(
    <>
      <div>
        <div className="eyebrow">{empresa.nome}</div>
        <h1 className="titulo-pagina mt-1">{titulo}</h1>
        {item && <p className="text-[14px] text-fg-3 mt-1">{nomeDoMes(item.competencia as string)}</p>}
      </div>
      {aberto ? (
        <section className="card p-4 flex flex-col gap-3">
          <BotoesEnvio token={params.token} empresas={ator.empresas.map((e) => ({ id: e.id, nome: e.nome, cnpj: e.cnpj }))}
            item={item ? { id: item.id as string, titulo, empresaId: empresa.id, tipoId: item.tipo_id as string, subtipoId: item.subtipo_id as string | null, sensivel: item.sensivel as boolean } : null} escanear />
          <BotoesEnvio token={params.token} empresas={ator.empresas.map((e) => ({ id: e.id, nome: e.nome, cnpj: e.cnpj }))}
            item={item ? { id: item.id as string, titulo, empresaId: empresa.id, tipoId: item.tipo_id as string, subtipoId: item.subtipo_id as string | null, sensivel: item.sensivel as boolean } : null} grande />
        </section>
      ) : <div className="vazio">Este pedido já foi enviado. Obrigado!</div>}
      <a href="/entrar" className="text-[13px] text-fg-3 underline self-start">Ver histórico e pasta (pede a entrada com digital ou rosto)</a>
    </>
  );
}
