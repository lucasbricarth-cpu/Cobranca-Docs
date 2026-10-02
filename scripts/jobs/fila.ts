// Worker da fila (cron: * * * * *): antivírus, miniaturas, classificação, avisos e WhatsApp.
import { carregarEnv } from '../env.ts';
carregarEnv();
const r = await fetch(`${process.env.APP_URL}/api/jobs/fila`, { method: 'POST', headers: { authorization: `Bearer ${process.env.JOB_SECRET}` } });
console.log(r.status, await r.text());
if (!r.ok) process.exit(1);
