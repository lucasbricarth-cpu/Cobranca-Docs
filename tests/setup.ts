import { carregarEnv } from '../scripts/env.ts';

carregarEnv();
process.env.EMAIL = 'log';
process.env.ARMAZENAMENTO = 'memoria';
process.env.IA = process.env.IA_TESTE ?? 'simulada';
process.env.WHATSAPP = 'simulado';
process.env.ANTIVIRUS = 'nenhum';
process.env.APP_URL = 'http://localhost:3000';
process.env.WHATSAPP_ESPERA_LOTE_MS = '0';
process.env.WHATSAPP_WEBHOOK_SECRET = 'segredo-teste';
