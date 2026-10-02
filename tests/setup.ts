import { carregarEnv } from '../scripts/env.ts';

carregarEnv();
process.env.EMAIL = 'log';
process.env.ARMAZENAMENTO = 'memoria';
process.env.IA = process.env.IA_TESTE ?? 'simulada';
process.env.WHATSAPP = 'simulado';
process.env.ANTIVIRUS = 'nenhum';
process.env.APP_URL = 'http://localhost:3000';
