/**
 * E-mail: interface única com dois adapters.
 * - log (desenvolvimento): escreve no log e devolve linkDev=true.
 * - ses: Amazon SES pelo domínio do escritório (SPF, DKIM e DMARC configurados no DNS).
 * O texto nunca traz o conteúdo do documento, o banco nem o valor (prompt §7).
 */
export interface Email { para: string; assunto: string; corpo: string; html?: string }
export interface ResultadoEmail { enviado: boolean; linkDev?: boolean; id?: string }

export async function enviarEmail(e: Email): Promise<ResultadoEmail> {
  const modo = process.env.EMAIL ?? 'log';
  if (modo === 'ses') return enviarPorSes(e);
  console.log(`[email:log] para=${e.para} assunto="${e.assunto}"\n${e.corpo}`);
  registrarLog(e);
  return { enviado: true, linkDev: true };
}

// Em desenvolvimento e nos testes guardamos os e-mails em memória para inspeção.
const ultimos: Email[] = [];
function registrarLog(e: Email) { ultimos.push(e); if (ultimos.length > 50) ultimos.shift(); }
export function emailsEnviadosNoLog(): Email[] { return [...ultimos]; }
export function limparLogDeEmails(): void { ultimos.length = 0; }

async function enviarPorSes(e: Email): Promise<ResultadoEmail> {
  const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
  const cliente = new SESClient({ region: process.env.SES_REGION || 'sa-east-1' });
  const r = await cliente.send(new SendEmailCommand({
    Source: process.env.EMAIL_REMETENTE,
    Destination: { ToAddresses: [e.para] },
    Message: {
      Subject: { Data: e.assunto, Charset: 'UTF-8' },
      Body: { Text: { Data: e.corpo, Charset: 'UTF-8' }, ...(e.html ? { Html: { Data: e.html, Charset: 'UTF-8' } } : {}) },
    },
  }));
  return { enviado: true, id: r.MessageId };
}
