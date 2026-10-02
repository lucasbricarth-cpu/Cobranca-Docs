/** Gatilhos de aviso (a Etapa 7 preenche: push ao funcionário quando chega arquivo para conferir). */
export async function aoReceberDocumento(_documentoId: string): Promise<void> {}
/** Rejeição: avisa o cliente que precisa refazer (Etapa 7). */
export async function aoRejeitar(_itemId: string): Promise<void> {}
/** Itens novos (pedido avulso ou agenda): avisa os clientes (Etapa 7). */
export async function aoCriarItens(_itemIds: string[]): Promise<void> {}
