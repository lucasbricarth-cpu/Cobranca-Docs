export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { jobAutorizado } from '@/lib/jobs/autorizar';
import { rodarFila } from '@/lib/fila';

/** Worker da fila (chamado a cada minuto pelo cron, como garantia do disparo imediato). */
export async function POST(req: Request) {
  if (!jobAutorizado(req)) return NextResponse.json({ ok: false }, { status: 401 });
  let total = 0;
  for (let i = 0; i < 10; i++) { const n = await rodarFila(25); total += n; if (n < 25) break; }
  return NextResponse.json({ ok: true, tarefas: total });
}
