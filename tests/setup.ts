import { carregarEnv } from '../scripts/env.ts';

carregarEnv();
// Os testes nunca falam com serviços de verdade, sejam quais forem as chaves do .env de quem roda.
process.env.EMAIL = 'log';
process.env.PUSH = 'log';
process.env.ARMAZENAMENTO = 'memoria';
process.env.IA = process.env.IA_TESTE ?? 'simulada';
process.env.WHATSAPP = 'simulado';
process.env.ANTIVIRUS = 'nenhum';
process.env.APP_URL = 'http://localhost:3000';
process.env.WHATSAPP_ESPERA_LOTE_MS = '0';
process.env.WHATSAPP_WEBHOOK_SECRET = 'segredo-teste';
