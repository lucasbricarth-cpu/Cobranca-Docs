export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { jobAutorizado } from '@/lib/jobs/autorizar';
import { rodarDiario } from '@/lib/jobs/diario';

/** Chamado pelo cron uma vez por dia (ex.: 06:00 em São Paulo). Idempotente. */
export async function POST(req: Request) {
  if (!jobAutorizado(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, resultado: await rodarDiario() });
}
