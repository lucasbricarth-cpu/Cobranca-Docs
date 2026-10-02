'use client';

/**
 * Envios guardados no aparelho quando não há sinal (IndexedDB, com pedido de
 * armazenamento persistente). No Android, sobem sozinhos pela sincronização
 * em segundo plano (o service worker faz o envio dos que têm pedido). No
 * iPhone o Safari não tem essa sincronização: o cartão diz "Abra o app para
 * terminar o envio", e eles sobem ao abrir.
 */
export interface EnvioPendente {
  id: string;
  criadoEm: number;
  nome: string;
  mime: string;
  arquivo: Blob;
  itemId: string | null;
  empresaId: string | null;
  tipoId: string | null;
  subtipoId: string | null;
  titulo: string;           // "Extrato Itaú final 0567" ou "Documento sem pedido"
  sensivel: boolean;
  token: string | null;     // link de envio (QR/WhatsApp), se veio por ele
  erro?: string;
}

const BANCO = 'pd-envios';
const LOJA = 'pendentes';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(LOJA, { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}
async function loja<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, falha) => {
    const t = db.transaction(LOJA, modo);
    const req = fn(t.objectStore(LOJA));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

export async function guardarEnvio(p: Omit<EnvioPendente, 'id' | 'criadoEm'>): Promise<EnvioPendente> {
  try { await navigator.storage?.persist?.(); } catch { /* sem suporte */ }
  const item: EnvioPendente = { ...p, id: crypto.randomUUID(), criadoEm: Date.now() };
  await loja('readwrite', (s) => s.put(item));
  // Android/Chrome: pede a sincronização em segundo plano.
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } })?.sync?.register('envios-pendentes');
  } catch { /* iPhone: sem Background Sync */ }
  return item;
}
export async function enviosGuardados(): Promise<EnvioPendente[]> {
  try { return await loja('readonly', (s) => s.getAll() as IDBRequest<EnvioPendente[]>); } catch { return []; }
}
export async function removerEnvio(id: string) { await loja('readwrite', (s) => s.delete(id)); }
export async function marcarErro(id: string, erro: string) {
  const todos = await enviosGuardados();
  const p = todos.find((x) => x.id === id);
  if (p) await loja('readwrite', (s) => s.put({ ...p, erro }));
}
export function temSincronizacaoEmSegundoPlano(): boolean {
  return typeof window !== 'undefined' && 'SyncManager' in window;
}
