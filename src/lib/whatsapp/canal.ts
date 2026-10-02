/**
 * Interface ÚNICA com o WhatsApp. O app fala com o número oficial SEMPRE pela
 * plataforma de atendimento que o escritório já usa (nunca direto com a Meta
 * pelo mesmo número, senão as duas recebem os mesmos avisos e respondem ao
 * mesmo cliente). Trocar de plataforma = escrever outro adaptador; o resto do
 * app não muda.
 *
 * Adaptadores:
 * - simulado: testes e desenvolvimento (grava o que "enviaria" no banco);
 * - a plataforma escolhida pelo escritório: ver docs/whatsapp.md (os 4 pontos
 *   a conferir na documentação dela) e src/lib/whatsapp/plataforma.ts.
 */
export interface Midia { id?: string; url?: string; mime?: string; nome?: string; base64?: string }
export type EventoWhatsApp =
  | { id: string; numero: string; tipo: 'arquivo'; midia: Midia; legenda?: string }
  | { id: string; numero: string; tipo: 'texto'; texto: string }
  | { id: string; numero: string; tipo: 'botao'; botaoId: string; texto?: string }
  | { id: string; numero: string; tipo: 'outro' };

export interface Botao { id: string; titulo: string; descricao?: string }

export interface CanalWhatsApp {
  /** Mensagem-modelo aprovada (categoria Utilidade), com variáveis e o sufixo da URL do botão. */
  enviarModelo(numero: string, modelo: { nome: string; idioma: string; variaveis: string[]; botaoUrlSufixo?: string; textoRenderizado: string }): Promise<void>;
  /** Botões (até 3) ou lista, dentro da conversa (janela de 24 h aberta pelo cliente). */
  enviarBotoes(numero: string, texto: string, botoes: Botao[]): Promise<void>;
  enviarTexto(numero: string, texto: string): Promise<void>;
  /** Baixa o arquivo na hora (o link de mídia da Meta expira em minutos). */
  baixarArquivo(midia: Midia): Promise<{ dados: Buffer; mime: string; nome: string }>;
  /** Nota interna na conversa, que só o atendente vê. */
  notaInterna(numero: string, texto: string): Promise<void>;
  /** Confere a assinatura do webhook e traduz o corpo em eventos. */
  interpretarWebhook(corpoBruto: string, cabecalhos: Headers): EventoWhatsApp[] | null;
  /** O que a plataforma suporta (os 4 pontos). */
  recursos: { webhookArquivo: boolean; modeloPorApi: boolean; botoes: boolean; notaInterna: boolean };
}

export async function canalWhatsApp(): Promise<CanalWhatsApp> {
  const modo = process.env.WHATSAPP ?? 'simulado';
  if (modo === 'simulado') return (await import('./simulado')).simulado;
  const { plataforma } = await import('./plataforma');
  return plataforma();
}
