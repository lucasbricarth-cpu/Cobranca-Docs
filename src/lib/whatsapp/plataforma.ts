import type { CanalWhatsApp } from './canal';

/**
 * Adaptador da plataforma de atendimento do escritório.
 *
 * [DECIDIR] Qual é a plataforma ligada ao número oficial? Antes de escrever
 * este adaptador, confira na documentação dela (com o link) os 4 pontos de
 * docs/whatsapp.md: webhook de mensagem recebida com o arquivo (obrigatório),
 * envio de mensagem-modelo por API (obrigatório), botões ou lista na conversa
 * (desejável) e nota interna (desejável).
 *
 * Enquanto não estiver pronto, use WHATSAPP=simulado e o botão
 * "Abrir no WhatsApp" (wa.me) dos pedidos, que funciona sem integração.
 */
export function plataforma(): CanalWhatsApp {
  throw new Error('Adaptador da plataforma de WhatsApp ainda não configurado. Veja docs/whatsapp.md.');
}
