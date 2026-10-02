import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { textoDoPdf } from './leitura';

/**
 * IA só para foto e PDF, e só para TIPO e SUBTIPO (o mês nunca vem da IA).
 * Um ponto único, `classificarDocumento`, para dar para trocar de fornecedor
 * sem mexer no resto. Tipos sensíveis NUNCA chegam aqui (quem chama garante,
 * e a função recusa se receber a marca de sensível).
 *
 * Fornecedor: Gemini 2.5 Flash pela Vertex AI em southamerica-east1 (nunca um
 * plano gratuito que treine com os dados). Se demorar ou falhar, o envio segue
 * e o arquivo vai para A conferir.
 */
export interface EntradaIA {
  arquivo: Buffer;
  mime: string;                                   // application/pdf ou image/*
  tipos: { id: string; nome: string }[];          // a lista de tipos do escritório (sem os sensíveis)
  subtipos: { id: string; rotulo: string }[];     // da empresa, com as contas mascaradas ("Itaú final 0567")
  sensivel?: false;                               // trava: sensível nunca entra
}
/** JSON fechado que a IA devolve. */
export interface RespostaIA {
  tipo: string;               // um nome da lista, ou "Outro"
  banco: string | null;       // como está escrito no documento
  agencia: string | null;
  final_conta: string | null; // últimos dígitos lidos da conta
  final_cartao: string | null;
  cnpjs: string[];
  trecho: string;             // o trecho que justificou a escolha
}

export class SensivelNaIA extends Error {}

/** Contagem de chamadas (os testes provam que nenhum sensível chega aqui). */
export const chamadasIA: { total: number; ultimas: EntradaIA[] } = { total: 0, ultimas: [] };

export async function classificarDocumento(e: EntradaIA & { sensivel?: boolean }, o: { prazoMs?: number } = {}): Promise<RespostaIA | null> {
  if (e.sensivel) throw new SensivelNaIA('Documento sensível não passa pela IA.');
  chamadasIA.total++; chamadasIA.ultimas.push(e); if (chamadasIA.ultimas.length > 20) chamadasIA.ultimas.shift();
  const modo = process.env.IA ?? 'nenhum';
  if (modo === 'nenhum') return null;
  const tarefa = modo === 'gemini' ? viaVertex(e) : simulada(e);
  const prazo = new Promise<null>((ok) => setTimeout(() => ok(null), o.prazoMs ?? Number(process.env.IA_PRAZO_MS ?? 25000)));
  try {
    const r = await Promise.race([tarefa, prazo]);
    return r ? normalizar(r, e) : null;
  } catch (err) {
    console.warn('[ia] falhou:', (err as Error).message);
    return null;
  }
}

function normalizar(r: Partial<RespostaIA>, e: EntradaIA): RespostaIA {
  const nomes = e.tipos.map((t) => t.nome);
  const so = (v: unknown, n = 6) => (v ? String(v).replace(/\D/g, '').slice(-n) || null : null);
  return {
    tipo: typeof r.tipo === 'string' && nomes.includes(r.tipo) ? r.tipo : 'Outro',
    banco: typeof r.banco === 'string' ? r.banco.slice(0, 60) : null,
    agencia: so(r.agencia, 6),
    final_conta: so(r.final_conta, 6),
    final_cartao: so(r.final_cartao, 4),
    cnpjs: Array.isArray(r.cnpjs) ? r.cnpjs.map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length === 14).slice(0, 10) : [],
    trecho: typeof r.trecho === 'string' ? r.trecho.slice(0, 280) : '',
  };
}

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    tipo: { type: 'STRING', description: 'Exatamente um nome da lista de tipos, ou "Outro".' },
    banco: { type: 'STRING', nullable: true },
    agencia: { type: 'STRING', nullable: true },
    final_conta: { type: 'STRING', nullable: true, description: 'Os últimos 4 a 6 dígitos da conta, se aparecer.' },
    final_cartao: { type: 'STRING', nullable: true, description: 'Os 4 últimos dígitos do cartão, se for fatura.' },
    cnpjs: { type: 'ARRAY', items: { type: 'STRING' } },
    trecho: { type: 'STRING', description: 'O trecho do documento que justificou a escolha (até 200 caracteres).' },
  },
  required: ['tipo', 'cnpjs', 'trecho'],
};

function instrucao(e: EntradaIA): string {
  return [
    'Você classifica documentos de um escritório de contabilidade. Responda só com o JSON pedido.',
    `Tipos possíveis: ${e.tipos.map((t) => `"${t.nome}"`).join(', ')}, ou "Outro".`,
    e.subtipos.length ? `Contas e cartões desta empresa (mascarados): ${e.subtipos.map((s) => s.rotulo).join('; ')}.` : '',
    'Não invente: se não aparecer no documento, use null. Nunca informe mês, valores ou nomes de pessoas.',
  ].filter(Boolean).join('\n');
}

let tokenCache: { token: string; expira: number } | null = null;
async function tokenGoogle(): Promise<string> {
  if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN;
  if (tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.token;
  // Conta de serviço (GOOGLE_APPLICATION_CREDENTIALS): JWT assinado (RS256) trocado por um token.
  const cred = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8')) as { client_email: string; private_key: string };
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: cred.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 })}`;
  const assinatura = createSign('RSA-SHA256').update(corpo).sign(cred.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${corpo}.${assinatura}` }),
  });
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function viaVertex(e: EntradaIA): Promise<Partial<RespostaIA> | null> {
  const local = process.env.VERTEX_LOCATION || 'southamerica-east1';
  const modelo = process.env.VERTEX_MODEL || 'gemini-2.5-flash';
  const url = `https://${local}-aiplatform.googleapis.com/v1/projects/${process.env.VERTEX_PROJECT}/locations/${local}/publishers/google/models/${modelo}:generateContent`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${await tokenGoogle()}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instrucao(e) }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: e.mime, data: e.arquivo.toString('base64') } }, { text: 'Classifique este documento.' }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: ESQUEMA, maxOutputTokens: 512 },
    }),
  });
  if (!r.ok) throw new Error(`Vertex ${r.status}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const texto = j.candidates?.[0]?.content?.parts?.[0]?.text;
  return texto ? JSON.parse(texto) : null;
}

/**
 * IA SIMULADA (desenvolvimento e testes): lê o texto do PDF e procura
 * palavras e números, devolvendo o mesmo JSON fechado. Não sai da máquina.
 */
async function simulada(e: EntradaIA): Promise<Partial<RespostaIA> | null> {
  if (e.mime !== 'application/pdf') return { tipo: 'Outro', cnpjs: [], trecho: '' };
  const texto = await textoDoPdf(e.arquivo).catch(() => '');
  const baixo = texto.toLowerCase();
  const tipo =
    /fatura|cart[aã]o/.test(baixo) ? 'Fatura de cartão'
    : /extrato/.test(baixo) ? 'Extrato bancário'
    : /guia|darf|das\b|comprovante/.test(baixo) ? 'Guias e comprovantes'
    : 'Outro';
  const banco = (texto.match(/\b(Ita[uú]|Sicredi|Bradesco|Santander|Banco do Brasil|Caixa|Nubank|Inter|Sicoob)\b/i) ?? [])[1] ?? null;
  const conta = (texto.match(/conta\s*[:#]?\s*([\d.\-]+)/i) ?? [])[1] ?? null;
  const cartao = (texto.match(/final\s*(\d{4})/i) ?? [])[1] ?? null;
  const cnpjs = [...texto.matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g)].map((m) => m[0]);
  return { tipo, banco, final_conta: conta, final_cartao: tipo === 'Fatura de cartão' ? cartao : null, cnpjs, agencia: null, trecho: texto.slice(0, 120) };
}
