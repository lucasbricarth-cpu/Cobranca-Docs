import { todos, um } from '@/lib/db';
import { nomeDoSubtipo, nomeGerado, nomeDoDownload, type DadosDoSubtipo } from './nomes';
import { hojeSP } from '@/lib/tempo';

/**
 * Leituras da pasta do cliente. Tipo, subtipo e mês são campos do registro,
 * então a mesma base aparece de duas formas: o checklist do mês ("Este mês")
 * e o arquivo por tipo ("Arquivo"). Documentos em processamento ou recusados
 * nunca aparecem. Sensíveis só para quem pode (podeSensivel).
 */
export type StatusItemTela = 'pendente' | 'atrasado' | 'recebido' | 'conferido' | 'refazer';

export interface ItemDoMes {
  id: string; tipo_id: string; tipo_nome: string; sensivel: boolean; subtipo_id: string | null; subtipo: DadosDoSubtipo | null;
  titulo: string; status: StatusItemTela; prazo: string | null; motivo_refazer: string | null;
  documento_id: string | null; recebido_em: Date | null; origem: string | null; ultimo_lembrete: Date | null; ultimo_lembrete_canal: string | null;
}

const COLS_SUB = `s.nome AS sub_nome, s.cartao_final, s.cartao_emissor, cb.codigo_banco, cb.nome_banco, cb.final AS conta_final`;
const subDe = (r: Record<string, unknown>): DadosDoSubtipo | null =>
  r.sub_nome || r.cartao_final || r.conta_final
    ? { nome: r.sub_nome as string | null, cartao_final: r.cartao_final as string | null, cartao_emissor: r.cartao_emissor as string | null, codigo_banco: r.codigo_banco as string | null, nome_banco: r.nome_banco as string | null, conta_final: r.conta_final as string | null }
    : null;

export function statusDaTela(status: string, prazo: string | null, hoje = hojeSP()): StatusItemTela {
  if ((status === 'pendente' || status === 'refazer') && prazo && prazo < hoje) return status === 'refazer' ? 'refazer' : 'atrasado';
  return status as StatusItemTela;
}

export async function checklistDoMes(empresaId: string, competencia: string): Promise<ItemDoMes[]> {
  const linhas = await todos<Record<string, unknown>>(
    `SELECT i.id, i.tipo_id, t.nome AS tipo_nome, t.sensivel, i.subtipo_id, i.status, to_char(i.prazo, 'YYYY-MM-DD') AS prazo, i.motivo_refazer,
            i.documento_id, d.recebido_em, d.origem, ${COLS_SUB},
            (SELECT a.enviado_em FROM avisos a WHERE a.item_id = i.id AND a.status = 'enviado' ORDER BY a.enviado_em DESC LIMIT 1) AS ultimo_lembrete,
            (SELECT a.canal FROM avisos a WHERE a.item_id = i.id AND a.status = 'enviado' ORDER BY a.enviado_em DESC LIMIT 1) AS ultimo_lembrete_canal
     FROM itens_pedido i
     JOIN tipos_documento t ON t.id = i.tipo_id
     LEFT JOIN subtipos s ON s.id = i.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     LEFT JOIN documentos d ON d.id = i.documento_id
     WHERE i.empresa_id = $1 AND i.competencia = $2 AND i.status <> 'cancelado'
     ORDER BY t.ordem, cb.codigo_banco NULLS LAST, s.criado_em`, [empresaId, competencia]);
  const hoje = hojeSP();
  return linhas.map((r) => {
    const sub = subDe(r);
    const subNome = nomeDoSubtipo(sub);
    return {
      id: r.id as string, tipo_id: r.tipo_id as string, tipo_nome: r.tipo_nome as string, sensivel: r.sensivel as boolean,
      subtipo_id: r.subtipo_id as string | null, subtipo: sub,
      titulo: subNome ? `${tituloTipo(r.tipo_nome as string)} ${subNome}` : (r.tipo_nome as string),
      status: statusDaTela(r.status as string, r.prazo as string | null, hoje), prazo: r.prazo as string | null,
      motivo_refazer: r.motivo_refazer as string | null, documento_id: r.documento_id as string | null,
      recebido_em: r.recebido_em as Date | null, origem: r.origem as string | null,
      ultimo_lembrete: r.ultimo_lembrete as Date | null, ultimo_lembrete_canal: r.ultimo_lembrete_canal as string | null,
    };
  });
}
function tituloTipo(nome: string) { return nome === 'Extrato bancário' ? 'Extrato' : nome === 'Fatura de cartão' ? 'Fatura' : nome; }

export function resumoDoMes(itens: { status: StatusItemTela }[]) {
  const total = itens.length;
  const conferidos = itens.filter((i) => i.status === 'conferido').length;
  const recebidos = itens.filter((i) => i.status === 'recebido' || i.status === 'conferido').length;
  // O mês só é completo quando TODOS os itens estão conferidos. Recebido não é pronto.
  return { total, recebidos, conferidos, completo: total > 0 && conferidos === total };
}

export interface CartaoTipo { tipo_id: string | null; nome: string; icone: string; sensivel: boolean; quantidade: number; ultimo: Date | null; nao_reconhecidos?: boolean }

/** Grade da aba Arquivo: um cartão por tipo, mais "Não reconhecidos" quando houver. */
export async function cartoesDoArquivo(empresaId: string, podeSensivel: boolean): Promise<CartaoTipo[]> {
  const tipos = await todos<{ tipo_id: string; nome: string; icone: string; sensivel: boolean; quantidade: number; ultimo: Date | null }>(
    `SELECT t.id AS tipo_id, t.nome, t.icone, t.sensivel, count(d.id)::int AS quantidade, max(d.recebido_em) AS ultimo
     FROM tipos_documento t
     JOIN documentos d ON d.tipo_id = t.id AND d.empresa_id = $1 AND d.excluido_em IS NULL
          AND d.status IN ('a_conferir', 'conferido', 'rejeitado', 'substituido')
     WHERE ($2 OR NOT (t.sensivel OR d.sensivel))
     GROUP BY t.id ORDER BY t.ordem, t.nome`, [empresaId, podeSensivel]);
  const nr = await um<{ n: number; ultimo: Date | null }>(
    `SELECT count(*)::int AS n, max(recebido_em) AS ultimo FROM documentos
     WHERE empresa_id = $1 AND status = 'nao_reconhecido' AND excluido_em IS NULL AND ($2 OR NOT sensivel)`, [empresaId, podeSensivel]);
  const cartoes: CartaoTipo[] = tipos;
  if (nr && nr.n > 0) cartoes.push({ tipo_id: null, nome: 'Não reconhecidos', icone: 'help-circle', sensivel: false, quantidade: nr.n, ultimo: nr.ultimo, nao_reconhecidos: true });
  return cartoes;
}

export interface ArquivoDaLista {
  id: string; nome: string; nome_download: string; nome_original: string; tipo_id: string | null; tipo_nome: string | null;
  subtipo_id: string | null; subtipo_rotulo: string | null; competencia: string | null; status: string; sensivel: boolean;
  tem_miniatura: boolean; recebido_em: Date; origem: string; enviado_por: string | null; mime: string; extensao: string;
  empresa_id: string | null; empresa_nome: string | null; whatsapp_numero: string | null; motivo_rejeicao: string | null; sugestao: Record<string, unknown> | null;
}

export interface FiltroArquivos {
  empresaId?: string | null;          // undefined = todas; null = só sem empresa (pasta geral)
  tipoId?: string | null;
  naoReconhecidos?: boolean;
  aConferir?: boolean;
  subtipoIds?: string[];
  bancos?: string[];                  // códigos de banco (chip "Itaú" quando há várias contas)
  competencia?: string | null;
  texto?: string | null;
  podeSensivel: boolean;
  responsavelId?: string | null;      // fila do responsável
  /** Sem podeSensivel: ainda mostra os sensíveis das empresas em que este usuário é responsável da folha. */
  usuarioFolhaId?: string | null;
  /** false: esconde a pasta geral (sem empresa) de quem não é Admin nem responsável. */
  pastaGeral?: boolean;
  incluirSubstituidos?: boolean;
  ids?: string[];
  limite?: number;
}

export async function listarArquivos(f: FiltroArquivos): Promise<ArquivoDaLista[]> {
  const p: unknown[] = [];
  const w: string[] = ['d.excluido_em IS NULL', `d.status NOT IN ('processando', 'recusado')`];
  const add = (v: unknown) => { p.push(v); return `$${p.length}`; };
  if (f.ids) w.push(`d.id = ANY(${add(f.ids)}::uuid[])`);
  if (f.empresaId === null) w.push('d.empresa_id IS NULL');
  else if (f.empresaId) w.push(`d.empresa_id = ${add(f.empresaId)}`);
  if (f.naoReconhecidos) w.push(`d.status = 'nao_reconhecido'`);
  else if (f.aConferir) w.push(`d.status = 'a_conferir'`);
  else if (f.tipoId) w.push(`d.tipo_id = ${add(f.tipoId)}`, `d.status <> 'nao_reconhecido'`);
  if (!f.incluirSubstituidos && !f.tipoId) w.push(`d.status <> 'substituido'`);
  if (f.subtipoIds?.length) w.push(`d.subtipo_id = ANY(${add(f.subtipoIds)}::uuid[])`);
  if (f.bancos?.length) w.push(`cb.codigo_banco = ANY(${add(f.bancos)}::text[])`);
  if (f.competencia) w.push(`d.competencia = ${add(f.competencia)}`);
  if (!f.podeSensivel) {
    if (f.usuarioFolhaId) {
      w.push(`(NOT (d.sensivel OR coalesce(t.sensivel, false)) OR EXISTS (SELECT 1 FROM responsaveis_empresa r WHERE r.empresa_id = d.empresa_id AND r.usuario_id = ${add(f.usuarioFolhaId)} AND r.papel = 'folha'))`);
    } else {
      w.push(`NOT (d.sensivel OR coalesce(t.sensivel, false))`);
    }
  }
  if (f.pastaGeral === false) w.push('d.empresa_id IS NOT NULL');
  if (f.responsavelId) w.push(`(e.responsavel_id = ${add(f.responsavelId)} OR d.empresa_id IS NULL)`);
  if (f.texto) {
    const t = add(`%${f.texto}%`);
    w.push(`(unaccent(lower(d.nome_original)) LIKE unaccent(lower(${t})) OR unaccent(lower(coalesce(t.nome, ''))) LIKE unaccent(lower(${t}))
            OR unaccent(lower(coalesce(s.nome, ''))) LIKE unaccent(lower(${t})) OR coalesce(cb.final, '') LIKE ${t} OR coalesce(s.cartao_final, '') LIKE ${t})`);
  }
  const linhas = await todos<Record<string, unknown>>(
    `SELECT d.id, d.nome_original, d.tipo_id, t.nome AS tipo_nome, d.subtipo_id, to_char(d.competencia, 'YYYY-MM-DD') AS competencia, d.status,
            (d.sensivel OR coalesce(t.sensivel, false)) AS sensivel, d.miniatura_chave IS NOT NULL AS tem_miniatura, d.recebido_em, d.origem,
            coalesce(l.nome, u.nome) AS enviado_por, d.mime, d.extensao, d.empresa_id, e.nome AS empresa_nome, d.whatsapp_numero, d.motivo_rejeicao, d.sugestao,
            ${COLS_SUB}
     FROM documentos d
     LEFT JOIN tipos_documento t ON t.id = d.tipo_id
     LEFT JOIN subtipos s ON s.id = d.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     LEFT JOIN empresas e ON e.id = d.empresa_id
     LEFT JOIN logins_cliente l ON l.id = d.enviado_por_login LEFT JOIN usuarios u ON u.id = d.enviado_por_usuario
     WHERE ${w.join(' AND ')}
     ORDER BY d.competencia DESC NULLS FIRST, d.recebido_em DESC
     LIMIT ${Math.min(f.limite ?? 300, 1000)}`, p);
  return linhas.map((r) => {
    const sub = subDe(r);
    const base = { tipo_nome: r.tipo_nome as string | null, subtipo: sub, competencia: r.competencia as string | null, nome_original: r.nome_original as string, extensao: r.extensao as string };
    return {
      id: r.id as string, nome: nomeGerado(base), nome_download: nomeDoDownload(base), nome_original: r.nome_original as string,
      tipo_id: r.tipo_id as string | null, tipo_nome: r.tipo_nome as string | null, subtipo_id: r.subtipo_id as string | null,
      subtipo_rotulo: sub ? nomeDoSubtipo(sub) : null, competencia: r.competencia as string | null, status: r.status as string,
      sensivel: r.sensivel as boolean, tem_miniatura: r.tem_miniatura as boolean, recebido_em: r.recebido_em as Date, origem: r.origem as string,
      enviado_por: r.enviado_por as string | null, mime: r.mime as string, extensao: r.extensao as string, empresa_id: r.empresa_id as string | null,
      empresa_nome: r.empresa_nome as string | null, whatsapp_numero: r.whatsapp_numero as string | null, motivo_rejeicao: r.motivo_rejeicao as string | null,
      sugestao: r.sugestao as Record<string, unknown> | null,
    };
  });
}

export async function documentoPorId(id: string) {
  return (await listarArquivos({ ids: [id], podeSensivel: true, incluirSubstituidos: true }))[0] ?? null;
}

export async function auditoriaDoDocumento(id: string) {
  return todos<{ acao: string; de: Record<string, unknown> | null; para: Record<string, unknown> | null; quem: string; em: Date }>(
    `SELECT acao, de, para, quem, em FROM auditoria_documentos WHERE documento_id = $1 ORDER BY em DESC, id DESC`, [id]);
}

/** Registro de acesso (Etapa 9): quem abriu, baixou ou exportou o arquivo, e quando. */
export interface AcessoDoc { acao: 'abrir' | 'baixar' | 'miniatura' | 'exportar'; quem: string; lado: 'escritorio' | 'cliente'; em: Date }
export async function acessosDoDocumento(id: string, limite = 50): Promise<AcessoDoc[]> {
  return todos<AcessoDoc>(
    `SELECT a.acao, coalesce(u.nome, l.nome, '—') AS quem, CASE WHEN a.login_id IS NOT NULL THEN 'cliente' ELSE 'escritorio' END AS lado, a.em
     FROM acessos_documento a LEFT JOIN usuarios u ON u.id = a.usuario_id LEFT JOIN logins_cliente l ON l.id = a.login_id
     WHERE a.documento_id = $1 ORDER BY a.em DESC, a.id DESC LIMIT $2`, [id, limite]);
}

/** Registro de acesso geral (Admin), com filtro por empresa, pessoa e período. */
export async function registroDeAcesso(f: { empresaId?: string | null; quem?: string | null; desde?: string | null; limite?: number }) {
  const p: unknown[] = []; const w: string[] = ['true'];
  const add = (v: unknown) => { p.push(v); return `$${p.length}`; };
  if (f.empresaId) w.push(`d.empresa_id = ${add(f.empresaId)}`);
  if (f.quem) w.push(`unaccent(lower(coalesce(u.nome, l.nome, ''))) LIKE unaccent(lower(${add(`%${f.quem}%`)}))`);
  if (f.desde) w.push(`a.em >= (${add(f.desde)}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'`);
  const linhas = await todos<Record<string, unknown>>(
    `SELECT a.id, a.acao, a.em, a.documento_id, coalesce(u.nome, l.nome, '—') AS quem, CASE WHEN a.login_id IS NOT NULL THEN 'cliente' ELSE 'escritorio' END AS lado,
            d.empresa_id, e.nome AS empresa_nome, d.nome_original, d.extensao, t.nome AS tipo_nome, to_char(d.competencia, 'YYYY-MM-DD') AS competencia,
            d.excluido_em IS NOT NULL AS excluido, ${COLS_SUB}
     FROM acessos_documento a JOIN documentos d ON d.id = a.documento_id
     LEFT JOIN tipos_documento t ON t.id = d.tipo_id LEFT JOIN empresas e ON e.id = d.empresa_id
     LEFT JOIN subtipos s ON s.id = d.subtipo_id LEFT JOIN contas_bancarias cb ON cb.id = s.conta_bancaria_id
     LEFT JOIN usuarios u ON u.id = a.usuario_id LEFT JOIN logins_cliente l ON l.id = a.login_id
     WHERE ${w.join(' AND ')} ORDER BY a.em DESC, a.id DESC LIMIT ${Math.min(f.limite ?? 200, 1000)}`, p);
  return linhas.map((r) => ({
    id: String(r.id), acao: r.acao as AcessoDoc['acao'], em: r.em as Date, quem: r.quem as string, lado: r.lado as AcessoDoc['lado'],
    documento_id: r.documento_id as string, empresa_id: r.empresa_id as string | null, empresa_nome: r.empresa_nome as string | null, excluido: r.excluido as boolean,
    documento: r.excluido ? 'Documento excluído' : nomeGerado({ tipo_nome: r.tipo_nome as string | null, subtipo: subDe(r), competencia: r.competencia as string | null, nome_original: r.nome_original as string }),
  }));
}
