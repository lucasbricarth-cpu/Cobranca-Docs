import { todos, um } from '@/lib/db';
import type { TipoReal } from '@/lib/seguranca/tipo-arquivo';
import { apelidosDoBanco, nomeCurtoDoBanco } from '@/lib/bancos';
import { normalizarBusca } from '@/lib/texto';
import { competenciaDoMes, mesPorExtenso } from '@/lib/tempo';
import { lerNfe } from './xml';
import { lerOfx } from './ofx';
import { classificarDocumento, type RespostaIA } from './ia';
import { subtiposDaEmpresa } from '@/lib/documentos/subtipos';

/**
 * Classificação (Etapa 6):
 * - sem IA, de graça e exata: XML de NF-e (CNPJ e data de emissão) e OFX
 *   (banco, agência, conta e período); se o mês não bater com o pedido, o
 *   cliente é avisado na hora;
 * - IA só para foto e PDF, e só para tipo e subtipo; quem decide a subpasta é
 *   o CÓDIGO, comparando o que a IA leu com a lista; o nome do banco vem do
 *   CODIGO_BANCO da Domínio;
 * - sensível nunca passa pela IA;
 * - arquivamento automático começa desligado; ligado por tipo, só confere
 *   sozinho com CNPJ da empresa, tipo e subtipo do pedido, e com pedido.
 */
export interface Sugestao {
  tipoId: string | null;
  subtipoId: string | null;
  rotulo: string;
  origem: 'xml' | 'ofx' | 'ia';
  trecho?: string;
  novaConta?: string | null;   // "Nova conta encontrada": final lido que não está na lista
  competenciaLida?: string | null;
}

interface EntradaSugestao {
  dados: Buffer; tipoReal: TipoReal; empresaId: string | null; empresasDoLogin: string[]; cnpjs: string[];
  item: { tipoId: string; subtipoId: string | null; competencia?: string } | null;
}

async function tiposPorNome() {
  const t = await todos<{ id: string; nome: string; sensivel: boolean }>(`SELECT id, nome, sensivel FROM tipos_documento WHERE ativo`);
  return { lista: t, porNome: new Map(t.map((x) => [x.nome, x.id])), nomePorId: new Map(t.map((x) => [x.id, x.nome])) };
}

/** Compara o que foi lido (banco e final) com as contas/cartões da empresa. Bateu com um só: encaixa. */
export function decidirSubtipo(
  lido: { banco: string | null; final_conta: string | null; final_cartao: string | null; codigoBanco?: string | null },
  subtipos: { id: string; tipo_id: string; codigo_banco?: string | null; nome_banco?: string | null; conta_final?: string | null; cartao_final?: string | null }[],
  tipoId: string,
): { subtipoId: string | null; novaConta: string | null } {
  const doTipo = subtipos.filter((s) => s.tipo_id === tipoId);
  const final = (lido.final_cartao || lido.final_conta || '').replace(/\D/g, '');
  const bancoLido = lido.banco ? normalizarBusca(lido.banco) : null;
  const casaBanco = (s: (typeof doTipo)[number]) => {
    if (lido.codigoBanco) return (s.codigo_banco ?? '').padStart(3, '0') === lido.codigoBanco;
    if (!bancoLido || !s.codigo_banco) return true; // sem banco lido: decide pelo final
    return apelidosDoBanco(s.codigo_banco, s.nome_banco).some((a) => bancoLido.includes(normalizarBusca(a)));
  };
  const casaFinal = (s: (typeof doTipo)[number]) => {
    const f = s.conta_final ?? s.cartao_final ?? '';
    if (!final || !f) return false;
    // "final 0567" casa com uma conta lida "1056-7" (dígitos 10567) pelos últimos dígitos, com ou sem o dígito verificador.
    return final.endsWith(f) || final.slice(0, -1).endsWith(f) || f.endsWith(final.slice(-4));
  };
  const candidatos = doTipo.filter((s) => casaBanco(s) && casaFinal(s));
  if (candidatos.length === 1) return { subtipoId: candidatos[0].id, novaConta: null };
  if (candidatos.length === 0 && final) return { subtipoId: null, novaConta: `${lido.banco ?? (lido.codigoBanco ? nomeCurtoDoBanco(lido.codigoBanco) : 'Conta')} final ${final.slice(-4)}` };
  return { subtipoId: null, novaConta: null };
}

/** Sugestão de tipo e subtipo para o popup do cliente e para a fila A conferir. */
export async function sugerirParaEnvio(a: EntradaSugestao): Promise<{ sugestao: Sugestao | null; aviso?: string; cnpjs: string[] }> {
  const { porNome, lista } = await tiposPorNome();
  const cnpjEmpresa = async (id: string) => (await um<{ cnpj: string }>(`SELECT cnpj FROM empresas WHERE id = $1`, [id]))?.cnpj;

  // 1) XML de NF-e: exato, sem IA.
  if (a.tipoReal.familia === 'xml') {
    const n = lerNfe(a.dados);
    if (n) {
      const cnpjs = [n.emitente, n.destinatario].filter(Boolean) as string[];
      const candidatas = a.empresaId ? [a.empresaId] : a.empresasDoLogin;
      let tipoNome: string | null = null;
      for (const id of candidatas) {
        const c = await cnpjEmpresa(id);
        if (c && c === n.destinatario) { tipoNome = 'Notas fiscais de entrada'; break; }
        if (c && c === n.emitente) { tipoNome = 'Notas fiscais de saída'; break; }
      }
      const competenciaLida = n.emissao ? `${n.emissao.slice(0, 7)}-01` : null;
      const aviso = a.item?.competencia && competenciaLida && competenciaLida !== a.item.competencia
        ? `A nota é de ${mesPorExtenso(competenciaLida)}, mas o pedido é de ${mesPorExtenso(a.item.competencia)}. Confira se é o arquivo certo.` : undefined;
      const tipoId = tipoNome ? porNome.get(tipoNome) ?? null : null;
      return { sugestao: tipoId ? { tipoId, subtipoId: null, rotulo: tipoNome!, origem: 'xml', competenciaLida } : null, aviso, cnpjs };
    }
  }
  // 2) OFX: exato, sem IA.
  if (a.tipoReal.familia === 'ofx') {
    const o = lerOfx(a.dados);
    if (o) {
      const tipoId = porNome.get('Extrato bancário') ?? null;
      const competenciaLida = o.fim ? `${o.fim.slice(0, 7)}-01` : o.inicio ? `${o.inicio.slice(0, 7)}-01` : null;
      let subtipoId: string | null = null; let novaConta: string | null = null;
      if (tipoId && a.empresaId) {
        const r = decidirSubtipo({ banco: null, codigoBanco: o.banco, final_conta: o.conta, final_cartao: null }, await subtiposDaEmpresa(a.empresaId, tipoId), tipoId);
        subtipoId = r.subtipoId; novaConta = r.novaConta;
      }
      const subs = subtipoId ? (await subtiposDaEmpresa(a.empresaId!, tipoId!)).find((s) => s.id === subtipoId) : null;
      const aviso = a.item?.competencia && competenciaLida && competenciaLida !== a.item.competencia
        ? `O extrato é de ${mesPorExtenso(competenciaLida)}, mas o pedido é de ${mesPorExtenso(a.item.competencia)}. Confira se é o arquivo certo.` : undefined;
      return {
        sugestao: tipoId ? { tipoId, subtipoId, rotulo: `Extrato bancário${subs ? ` › ${subs.rotulo}` : novaConta ? ` › Nova conta encontrada (${novaConta})` : ''}`, origem: 'ofx', novaConta, competenciaLida } : null,
        aviso, cnpjs: a.cnpjs,
      };
    }
  }
  // 3) Foto e PDF: IA, só tipo e subtipo, com as contas mascaradas.
  if (a.tipoReal.familia !== 'pdf' && a.tipoReal.familia !== 'imagem') return { sugestao: null, cnpjs: a.cnpjs };
  const subtipos = a.empresaId ? await subtiposDaEmpresa(a.empresaId) : [];
  const r: RespostaIA | null = await classificarDocumento({
    arquivo: a.dados, mime: a.tipoReal.mime,
    tipos: lista.filter((t) => !t.sensivel).map((t) => ({ id: t.id, nome: t.nome })),
    subtipos: subtipos.filter((s) => s.ativo).map((s) => ({ id: s.id, rotulo: s.rotulo })),
  });
  if (!r) return { sugestao: null, cnpjs: a.cnpjs };
  const cnpjs = [...new Set([...a.cnpjs, ...r.cnpjs])];
  const tipoId = r.tipo !== 'Outro' ? porNome.get(r.tipo) ?? null : null;
  if (!tipoId) return { sugestao: null, cnpjs };
  let subtipoId: string | null = null; let novaConta: string | null = null;
  if (subtipos.some((s) => s.tipo_id === tipoId)) ({ subtipoId, novaConta } = decidirSubtipo(r, subtipos, tipoId));
  const sub = subtipoId ? subtipos.find((s) => s.id === subtipoId) : null;
  return {
    sugestao: { tipoId, subtipoId, rotulo: `${r.tipo}${sub ? ` › ${sub.rotulo}` : novaConta ? ` › Nova conta encontrada (${novaConta})` : ''}`, origem: 'ia', trecho: r.trecho, novaConta },
    cnpjs,
  };
}

/* ───────────────────────── processamento (fila) ───────────────────────── */

export interface ContextoClassificacao {
  documentoId: string;
  empresaId: string | null;
  tipoId: string | null;
  subtipoId: string | null;
  competencia: string | null;
  comPedido: boolean;
  sensivel: boolean;
  loginId: string | null;
  tipoReal: TipoReal;
}
export interface DecisaoClassificacao {
  tipoId: string | null; subtipoId: string | null; empresaId: string | null; competencia: string | null;
  cnpjs: string[]; sugestao: Record<string, unknown> | null;
  status: 'a_conferir' | 'nao_reconhecido' | 'conferido';
  avisoMes?: string | null;
}

/**
 * Decide o destino do arquivo depois do antivírus. Arquivo com sugestão de
 * tipo vai para A conferir; sem tipo identificado, ou sem empresa, vai para
 * Não reconhecidos. Nada é arquivado por palpite.
 */
export async function classificarEnvio(ctx: ContextoClassificacao, dados: Buffer): Promise<DecisaoClassificacao> {
  const doc = await um<{ sugestao: { previa?: Sugestao } | null; cnpjs_lidos: string[] | null; item_tipo: string | null; item_sub: string | null; item_comp: string | null }>(
    `SELECT d.sugestao, d.cnpjs_lidos, i.tipo_id AS item_tipo, i.subtipo_id AS item_sub, to_char(i.competencia, 'YYYY-MM-DD') AS item_comp
     FROM documentos d LEFT JOIN itens_pedido i ON i.id = d.item_id WHERE d.id = $1`, [ctx.documentoId]);
  let cnpjs = doc?.cnpjs_lidos ?? [];
  let sugestao: Sugestao | null = doc?.sugestao?.previa ?? null;
  if (!ctx.sensivel && !sugestao) {
    const r = await sugerirParaEnvio({
      dados, tipoReal: ctx.tipoReal, empresaId: ctx.empresaId, empresasDoLogin: ctx.empresaId ? [ctx.empresaId] : [], cnpjs,
      item: doc?.item_tipo ? { tipoId: doc.item_tipo, subtipoId: doc.item_sub, competencia: doc.item_comp ?? undefined } : null,
    });
    sugestao = r.sugestao; cnpjs = r.cnpjs;
  }
  const tipoId = ctx.tipoId ?? sugestao?.tipoId ?? null;
  const subtipoId = ctx.subtipoId ?? (sugestao?.tipoId === tipoId ? sugestao?.subtipoId ?? null : null);
  const competencia = ctx.competencia;
  let status: DecisaoClassificacao['status'] = ctx.empresaId && tipoId ? 'a_conferir' : 'nao_reconhecido';

  if (status === 'a_conferir' && (await podeArquivarSozinho({ ...ctx, tipoId, subtipoId }, sugestao, cnpjs, doc?.item_tipo ?? null, doc?.item_sub ?? null))) status = 'conferido';
  return {
    tipoId, subtipoId, empresaId: ctx.empresaId, competencia, cnpjs,
    sugestao: sugestao ? { ...(doc?.sugestao ?? {}), sugerido: sugestao } : (doc?.sugestao ?? null),
    status,
  };
}

/**
 * Arquivamento automático (ligado por tipo, pelo Admin). Só confere sozinho quando:
 * - o envio tinha pedido;
 * - o tipo e o subtipo sugeridos são os do pedido;
 * - um CNPJ lido no arquivo é o da empresa do pedido (uma empresa do login).
 * Foto ou PDF sem pedido nunca é conferido sozinho.
 */
async function podeArquivarSozinho(ctx: ContextoClassificacao & { tipoId: string | null; subtipoId: string | null }, s: Sugestao | null, cnpjs: string[], itemTipo: string | null, itemSub: string | null): Promise<boolean> {
  if (!ctx.comPedido || !itemTipo || !ctx.empresaId || !s || ctx.sensivel) return false;
  const tipo = await um<{ arquivamento_automatico: boolean }>(`SELECT arquivamento_automatico FROM tipos_documento WHERE id = $1`, [itemTipo]);
  if (!tipo?.arquivamento_automatico) return false;
  if (s.tipoId !== itemTipo || (s.subtipoId ?? null) !== (itemSub ?? null)) return false;
  const emp = await um<{ cnpj: string }>(`SELECT e.cnpj FROM empresas e WHERE e.id = $1`, [ctx.empresaId]);
  if (!emp || !cnpjs.includes(emp.cnpj)) return false;
  if (ctx.loginId) {
    const vinc = await um(`SELECT 1 FROM vinculos_login_empresa WHERE login_id = $1 AND empresa_id = $2`, [ctx.loginId, ctx.empresaId]);
    if (!vinc) return false;
  }
  return true;
}

/* ───────────────────────── acerto por tipo ───────────────────────── */

/** Guarda a correção do funcionário (sugestão × escolha final) ao conferir. Uma por documento. */
export async function registrarCorrecao(c: { query: (t: string, p: unknown[]) => Promise<unknown> }, documentoId: string, usuarioId: string) {
  await c.query(
    `INSERT INTO correcoes_classificacao (documento_id, origem, tipo_sugerido, subtipo_sugerido, tipo_final, subtipo_final, acertou_tipo, acertou_subtipo, usuario_id)
     SELECT d.id, s.origem, s.tipo, s.sub, d.tipo_id, d.subtipo_id,
            s.tipo IS NOT DISTINCT FROM d.tipo_id,
            CASE WHEN d.subtipo_id IS NULL AND s.sub IS NULL THEN NULL ELSE s.sub IS NOT DISTINCT FROM d.subtipo_id END, $2
     FROM documentos d,
          LATERAL (SELECT coalesce(d.sugestao->'sugerido', d.sugestao->'previa') AS j) x,
          LATERAL (SELECT x.j->>'origem' AS origem, (x.j->>'tipoId')::uuid AS tipo, nullif(x.j->>'subtipoId', '')::uuid AS sub) s
     WHERE d.id = $1 AND x.j IS NOT NULL AND s.origem IN ('xml', 'ofx', 'ia')
     ON CONFLICT (documento_id) DO NOTHING`, [documentoId, usuarioId]);
}

export async function taxaDeAcerto(desde?: string) {
  return todos<{ tipo_id: string; tipo: string; total: number; acertos_tipo: number; com_subtipo: number; acertos_subtipo: number }>(
    `SELECT t.id AS tipo_id, t.nome AS tipo, count(c.id)::int AS total, count(*) FILTER (WHERE c.acertou_tipo)::int AS acertos_tipo,
            count(c.acertou_subtipo)::int AS com_subtipo, count(*) FILTER (WHERE c.acertou_subtipo)::int AS acertos_subtipo
     FROM correcoes_classificacao c JOIN tipos_documento t ON t.id = c.tipo_final
     WHERE ($1::date IS NULL OR c.em >= $1) GROUP BY t.id ORDER BY t.ordem`, [desde ?? null]);
}

export { competenciaDoMes };
