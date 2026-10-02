// Dispara o job diário no app (cron: 0 6 * * *, com TZ=America/Sao_Paulo ou o equivalente em UTC).
import { carregarEnv } from '../env.ts';
carregarEnv();
const r = await fetch(`${process.env.APP_URL}/api/jobs/diario`, { method: 'POST', headers: { authorization: `Bearer ${process.env.JOB_SECRET}` } });
console.log(r.status, await r.text());
if (!r.ok) process.exit(1);
