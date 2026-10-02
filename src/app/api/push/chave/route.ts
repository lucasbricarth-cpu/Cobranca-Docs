export const dynamic = 'force-dynamic';
/** Chave pública VAPID (pode ser exposta). */
export async function GET() {
  return Response.json({ publica: process.env.VAPID_PUBLIC_KEY || null });
}
