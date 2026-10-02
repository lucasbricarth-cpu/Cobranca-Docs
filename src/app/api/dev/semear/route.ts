export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { semearDocumentos } from '@/lib/dev/semente-documentos';

/** Só com DEV_LOGIN=1 e por localhost: semeia documentos de demonstração (capturas). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (process.env.DEV_LOGIN !== '1' || !['localhost', '127.0.0.1'].includes(url.hostname)) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json(await semearDocumentos());
}
