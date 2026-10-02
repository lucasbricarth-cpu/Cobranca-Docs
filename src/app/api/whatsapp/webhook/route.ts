export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { receberWebhook } from '@/lib/whatsapp/fluxo';

/**
 * Webhook da plataforma de atendimento: confirma na hora (o resto vai para a
 * fila). Assinatura conferida pelo adaptador; aviso repetido não duplica.
 */
export async function POST(req: Request) {
  const corpo = await req.text();
  if (corpo.length > 40 * 1024 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
  const r = await receberWebhook(corpo, req.headers).catch((e) => { console.error('[whatsapp]', e); return undefined; });
  if (r === null) return NextResponse.json({ ok: false, erro: 'assinatura inválida' }, { status: 401 });
  return NextResponse.json({ ok: true, ...(r ?? {}) });
}
