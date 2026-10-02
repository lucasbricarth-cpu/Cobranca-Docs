import { todos } from '@/lib/db';

/**
 * Textos de aviso (push, e-mail e WhatsApp), editáveis em Ajustes › Mensagens
 * sem mexer no código. As variáveis vão entre chaves: {empresa}, {link}…
 * Regra: nenhum texto mostra o conteúdo do documento, o banco nem o valor.
 * O detalhe só aparece depois de entrar.
 */
export const TEXTOS_PADRAO: Record<string, { canal: 'email' | 'push' | 'whatsapp'; descricao: string; texto: string }> = {
  'email.link.assunto': { canal: 'email', descricao: 'Assunto do e-mail com o link de entrada', texto: 'Seu link para entrar no portal de documentos' },
  'email.link.corpo': { canal: 'email', descricao: 'Corpo do e-mail com o link de entrada', texto: 'Olá!\n\nPara entrar no portal de documentos do escritório, abra este link (vale por 30 minutos):\n\n{link}\n\nSe não foi você quem pediu, ignore esta mensagem.' },
  'email.convite.assunto': { canal: 'email', descricao: 'Assunto do convite a um novo cliente', texto: 'Convite: portal de documentos do escritório' },
  'email.convite.corpo': { canal: 'email', descricao: 'Corpo do convite a um novo cliente', texto: 'Olá, {nome}!\n\nO escritório preparou um portal para você enviar e acompanhar os documentos de {empresa}. Entre por este link:\n\n{link}\n\nDepois, cadastre a sua digital ou rosto para entrar sem senha.' },
  'push.pedido.criado': { canal: 'push', descricao: 'Push ao criar um pedido', texto: 'Você tem um novo pedido do escritório.' },
  'push.pedido.3dias': { canal: 'push', descricao: 'Push 3 dias antes do prazo', texto: 'Um pedido do escritório vence em 3 dias.' },
  'push.pedido.dia': { canal: 'push', descricao: 'Push no dia do prazo', texto: 'Um pedido do escritório vence hoje.' },
  'push.pedido.atraso': { canal: 'push', descricao: 'Push depois do atraso', texto: 'Um pedido do escritório está atrasado.' },
  'push.refazer': { canal: 'push', descricao: 'Push ao pedir para refazer um envio', texto: 'O escritório pediu para refazer um envio.' },
  'push.conferir': { canal: 'push', descricao: 'Push ao funcionário: chegou arquivo para conferir', texto: 'Chegou um arquivo para conferir em {empresa}.' },
  'email.pedido.assunto': { canal: 'email', descricao: 'Assunto do e-mail de pedido ou lembrete', texto: 'Pedido do escritório: {titulo}' },
  'email.pedido.corpo': { canal: 'email', descricao: 'Corpo do e-mail de pedido ou lembrete', texto: 'Olá, {nome}!\n\n{titulo}\n\nAbra o portal para ver o detalhe e enviar:\n\n{link}\n\nEste link é só seu e expira.' },
  'email.resumo.assunto': { canal: 'email', descricao: 'Assunto do resumo diário do funcionário', texto: 'Resumo do dia: {conferir} para conferir, {atrasados} atrasados' },
  'email.resumo.corpo': { canal: 'email', descricao: 'Corpo do resumo diário do funcionário', texto: 'Bom dia, {nome}!\n\nHoje você tem {conferir} arquivo(s) para conferir, {atrasados} item(ns) atrasado(s) e {semana} que vence(m) nesta semana.\n\n{link}' },
  'wa.pedido': { canal: 'whatsapp', descricao: 'Mensagem-modelo (Utilidade) do pedido', texto: 'Olá, {nome}. O escritório precisa de um documento de {empresa} referente a {mes}, até {prazo}. Você pode enviar pelo app ou responder a esta conversa com o arquivo.' },
  'wa.lembrete.dia': { canal: 'whatsapp', descricao: 'Mensagem-modelo (Utilidade) do lembrete no dia do prazo', texto: 'Olá, {nome}. Lembrete: o documento de {empresa} referente a {mes} vence hoje. Envie pelo app ou responda a esta conversa com o arquivo.' },
  'wa.recebido.generico': { canal: 'whatsapp', descricao: 'Resposta a um número sem vínculo confirmado', texto: 'Recebemos o seu arquivo, obrigado! A nossa equipe vai conferir e, se precisar de algo, entra em contato.' },
  'wa.recebido.sensivel': { canal: 'whatsapp', descricao: 'Resposta a um documento sensível', texto: 'Recebemos o seu documento. Obrigado!' },
  'wa.pergunta.empresa': { canal: 'whatsapp', descricao: 'Pergunta de empresa (número com várias)', texto: 'Esse documento é de qual empresa?' },
  'wa.pergunta.empresa.sugerida': { canal: 'whatsapp', descricao: 'Confirmação quando o CNPJ bateu', texto: 'Parece ser da {empresa}. Confirma?' },
  'wa.pergunta.mes': { canal: 'whatsapp', descricao: 'Pergunta de mês (dois ou mais abertos)', texto: 'É de qual mês?' },
  'wa.resultado': { canal: 'whatsapp', descricao: 'Resumo do que foi recebido', texto: 'Recebemos: {documento}, {mes}. Está certo?' },
  'wa.foto.ruim': { canal: 'whatsapp', descricao: 'Pedido de nova foto', texto: 'A imagem ficou difícil de ler. Pode mandar de novo? Dica: envie como "Documento", não como foto.' },
  'wa.resumo.varios': { canal: 'whatsapp', descricao: 'Resumo de vários arquivos seguidos', texto: 'Recebemos {n} arquivo(s). {detalhe}' },
};

let cache: { quando: number; valores: Map<string, string> } | null = null;

/** Texto final com as variáveis preenchidas. Lê a edição do escritório no banco (cache de 30 s). */
export async function texto(chave: string, vars: Record<string, string | number> = {}): Promise<string> {
  const base = TEXTOS_PADRAO[chave]?.texto ?? chave;
  let t = base;
  try {
    if (!cache || Date.now() - cache.quando > 30_000) {
      const linhas = await todos<{ chave: string; texto: string }>(`SELECT chave, texto FROM mensagens`);
      cache = { quando: Date.now(), valores: new Map(linhas.map((l) => [l.chave, l.texto])) };
    }
    t = cache.valores.get(chave) ?? base;
  } catch { /* antes da migration ou sem banco: usa o padrão */ }
  return preencher(t, vars);
}
export function preencher(t: string, vars: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
export function invalidarCacheDeTextos(): void { cache = null; }
