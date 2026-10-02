import { enfileirar, dispararFila } from '@/lib/fila';

/**
 * Gatilhos de aviso. Tudo vai pela fila (não atrasa quem envia nem quem
 * confere), e a chave única dos avisos garante que nada sai duas vezes.
 */
export async function aoReceberDocumento(documentoId: string): Promise<void> {
  await enfileirar('avisar_conferir', { documentoId }, { chave: `avisar_conferir:${documentoId}` });
  dispararFila();
}
/** Rejeição: avisa o cliente que precisa refazer (uma vez por rejeição). */
export async function aoRejeitar(itemId: string, documentoId?: string): Promise<void> {
  await enfileirar('avisar_itens', { ids: [itemId], etapa: `refazer:${documentoId ?? itemId}` }, { chave: `refazer:${itemId}:${documentoId ?? ''}` });
  dispararFila();
}
/** Itens novos (pedido avulso ou agenda): avisa os clientes. */
export async function aoCriarItens(itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  await enfileirar('avisar_itens', { ids: itemIds, etapa: 'criado' });
  dispararFila();
}
