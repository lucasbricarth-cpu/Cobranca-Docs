'use client';
/** fetch JSON com o formato { ok, erro } das rotas do app. */
export async function chamar<T = Record<string, unknown>>(url: string, metodo: string = 'GET', corpo?: unknown): Promise<T & { ok: boolean; erro?: string }> {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({ ok: false, erro: 'Resposta inválida do servidor.' }));
  if (!r.ok && j.ok !== false) return { ...j, ok: false, erro: j.erro ?? `Erro ${r.status}` };
  return j;
}
