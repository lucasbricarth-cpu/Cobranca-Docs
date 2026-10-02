import { createHmac, timingSafeEqual } from 'node:crypto';
import { q } from '@/lib/db';
import type { CanalWhatsApp, EventoWhatsApp } from './canal';

/**
 * Adaptador SIMULADO (testes e desenvolvimento). Não sai da máquina: o que
 * "enviaria" fica em whatsapp_enviadas. O webhook aceita um formato simples,
 * assinado com HMAC-SHA256 (WHATSAPP_WEBHOOK_SECRET) no cabeçalho x-assinatura.
 *
 * Formato: { "mensagens": [ { "id", "de", "tipo": "arquivo|texto|botao|audio",
 *            "arquivo": { "base64", "mime", "nome" }, "texto", "botao" } ] }
 */
async function registrar(numero: string, tipo: string, conteudo: unknown) {
  await q(`INSERT INTO whatsapp_enviadas (numero, tipo, conteudo) VALUES ($1, $2, $3)`, [numero, tipo, JSON.stringify(conteudo)]);
}

export function assinarSimulado(corpo: string): string {
  return createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET ?? 'segredo-dev').update(corpo).digest('hex');
}

export const simulado: CanalWhatsApp = {
  recursos: { webhookArquivo: true, modeloPorApi: true, botoes: true, notaInterna: true },
  async enviarModelo(numero, m) { await registrar(numero, 'modelo', m); },
  async enviarBotoes(numero, texto, botoes) { await registrar(numero, 'botoes', { texto, botoes }); },
  async enviarTexto(numero, texto) { await registrar(numero, 'texto', { texto }); },
  async notaInterna(numero, texto) { await registrar(numero, 'nota', { texto }); },
  async baixarArquivo(midia) {
    if (!midia.base64) throw new Error('mídia indisponível');
    return { dados: Buffer.from(midia.base64, 'base64'), mime: midia.mime ?? 'application/octet-stream', nome: midia.nome ?? 'arquivo' };
  },
  interpretarWebhook(corpoBruto, cabecalhos) {
    const veio = cabecalhos.get('x-assinatura') ?? '';
    const esperado = assinarSimulado(corpoBruto);
    const a = Buffer.from(veio), b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const j = JSON.parse(corpoBruto) as { mensagens?: Record<string, unknown>[] };
    return (j.mensagens ?? []).map((m): EventoWhatsApp => {
      const id = String(m.id), numero = String(m.de).replace(/\D/g, '');
      if (m.tipo === 'arquivo') { const a = m.arquivo as Record<string, string>; return { id, numero, tipo: 'arquivo', midia: { base64: a.base64, mime: a.mime, nome: a.nome }, legenda: m.texto as string | undefined }; }
      if (m.tipo === 'botao') return { id, numero, tipo: 'botao', botaoId: String(m.botao) };
      if (m.tipo === 'texto') return { id, numero, tipo: 'texto', texto: String(m.texto ?? '') };
      return { id, numero, tipo: 'outro' };
    });
  },
};
