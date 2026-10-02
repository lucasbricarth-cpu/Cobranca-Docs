'use client';

/** Chamadas do envio: com a sessão (cookie) ou com o token do link de envio (QR/WhatsApp). */
export async function api<T = Record<string, unknown>>(url: string, metodo = 'GET', corpo?: unknown, token?: string | null): Promise<T & { ok: boolean; erro?: string }> {
  const h: Record<string, string> = {};
  if (corpo !== undefined) h['content-type'] = 'application/json';
  if (token) h['x-envio-token'] = token;
  try {
    const r = await fetch(url, { method: metodo, headers: h, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({ ok: false, erro: 'Resposta inválida.' }));
    return r.ok ? j : { ...j, ok: false, erro: j.erro ?? `Erro ${r.status}` };
  } catch {
    return { ok: false, erro: 'sem-rede' } as T & { ok: boolean; erro?: string };
  }
}

/** PUT do arquivo na URL assinada, com progresso. */
export function enviarBytes(url: string, cabecalhos: Record<string, string>, arquivo: Blob, aoProgresso?: (p: number) => void): Promise<boolean> {
  return new Promise((ok) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    for (const [k, v] of Object.entries(cabecalhos)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgresso?.(e.loaded / e.total); };
    x.onload = () => ok(x.status >= 200 && x.status < 300);
    x.onerror = () => ok(false);
    x.send(arquivo);
  });
}
