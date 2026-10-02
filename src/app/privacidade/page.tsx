import { todos } from '@/lib/db';
import { Marca } from '@/components/ui/Marca';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Privacidade' };

/** Aviso de privacidade dentro do portal, com o texto que o escritório aprovar (Ajustes › Mensagens, chave privacidade.texto). */
export default async function Privacidade() {
  let textoAviso = '';
  try {
    const r = await todos<{ texto: string }>(`SELECT texto FROM mensagens WHERE chave = 'privacidade.texto'`);
    textoAviso = r[0]?.texto ?? '';
  } catch { /* antes da migration */ }
  return (
    <main className="min-h-dvh p-4 md:p-8 max-w-[720px] mx-auto">
      <div className="glass-panel p-6 md:p-8" style={{ borderRadius: 26 }}>
        <div className="mb-5"><Marca /></div>
        <h1 className="titulo-pagina mb-4">Aviso de privacidade</h1>
        <div className="text-[14px] leading-relaxed whitespace-pre-wrap text-fg-2">{textoAviso || 'O escritório ainda não publicou o texto do aviso de privacidade. Ele é editado em Ajustes › Mensagens.'}</div>
        <h2 className="h2 mt-6 mb-2">Operadores de dados</h2>
        <ul className="text-[13.5px] text-fg-2 list-disc pl-5 space-y-1">
          <li>Armazenamento dos arquivos: nuvem compatível com S3, região de São Paulo, privado e criptografado.</li>
          <li>E-mail: Amazon SES.</li>
          <li>Classificação por IA (só tipo e subtipo de fotos e PDFs não sensíveis): Google Cloud Vertex AI, região southamerica-east1.</li>
          <li>WhatsApp: a plataforma de atendimento do escritório e a Meta (WhatsApp Business Platform).</li>
        </ul>
      </div>
    </main>
  );
}
