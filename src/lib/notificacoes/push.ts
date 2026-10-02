import { q, todos } from '@/lib/db';

/**
 * Web Push padrão (VAPID): o mesmo push vale para Android, iPhone (iOS 16.4+
 * com o app na Tela de Início) e o navegador do computador. O texto é sempre
 * genérico; o detalhe só aparece depois de entrar.
 */
export interface MensagemPush { title: string; body: string; url: string; tag?: string }
const enviadosNoLog: (MensagemPush & { endpoint: string })[] = [];
export function pushesNoLog() { return [...enviadosNoLog]; }
export function limparPushesNoLog() { enviadosNoLog.length = 0; }

export async function enviarPush(dono: { loginId?: string | null; usuarioId?: string | null }, m: MensagemPush): Promise<{ enviados: number; semAssinatura: boolean }> {
  const subs = await todos<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    `SELECT id, endpoint, p256dh, auth FROM push_assinaturas WHERE ($1::uuid IS NOT NULL AND login_id = $1) OR ($2::uuid IS NOT NULL AND usuario_id = $2)`,
    [dono.loginId ?? null, dono.usuarioId ?? null]);
  if (!subs.length) return { enviados: 0, semAssinatura: true };
  const real = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.PUSH !== 'log';
  let enviados = 0;
  for (const s of subs) {
    if (!real) { enviadosNoLog.push({ ...m, endpoint: s.endpoint }); enviados++; continue; }
    try {
      const webpush = (await import('web-push')).default;
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@escritorio.com.br', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 60 * 60 * 24 });
      enviados++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Assinatura que não existe mais (aparelho trocado, permissão revogada): some.
      if (status === 404 || status === 410) await q(`DELETE FROM push_assinaturas WHERE id = $1`, [s.id]);
      else await q(`UPDATE push_assinaturas SET falhou_em = now() WHERE id = $1`, [s.id]);
    }
  }
  return { enviados, semAssinatura: false };
}
