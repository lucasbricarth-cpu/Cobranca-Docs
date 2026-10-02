import archiver from 'archiver';
import type { Writable } from 'node:stream';
import { todos, um, q } from '@/lib/db';
import { armazenamento } from '@/lib/armazenamento';
import { listarArquivos, type ArquivoDaLista } from '@/lib/documentos/consultas';
import { anoMes, nomeDoMes, dataSP, horaSP } from '@/lib/tempo';
import { formatarCnpj } from '@/lib/texto';

/**
 * "Exportar tudo" de uma empresa (saída de um cliente): um ZIP com a MESMA
 * árvore de pastas do app (Tipo › Subtipo › Mês), mais um índice em CSV.
 * Fica no registro de acesso (ação "exportar") e em `exportacoes`. Só uma
 * exportação concluída sem falhas libera a exclusão da saída.
 */

/** Nome de pasta seguro no Windows e no macOS, mantendo acentos e espaços. */
export function pastaSegura(s: string): string {
  const limpo = s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return limpo.slice(0, 80) || 'Sem nome';
}

/** "Extratos bancários/Itaú final 0567/2026-09 Setembro/Extrato_Itau_0567_2026-09.pdf" (dentro da pasta da empresa). */
export function caminhoNoZip(d: Pick<ArquivoDaLista, 'tipo_nome' | 'subtipo_rotulo' | 'competencia' | 'status' | 'nome_download'>): string {
  const partes: string[] = [];
  if (!d.tipo_nome || d.status === 'nao_reconhecido') partes.push('Não reconhecidos');
  else {
    partes.push(pastaSegura(d.tipo_nome));
    if (d.subtipo_rotulo) partes.push(pastaSegura(d.subtipo_rotulo));
    partes.push(d.competencia ? `${anoMes(d.competencia)} ${nomeDoMes(d.competencia).replace(/\s*\d{4}$/, '')}` : 'Sem mês');
  }
  if (d.status === 'substituido') partes.push('Versões anteriores');
  partes.push(d.nome_download);
  return partes.join('/');
}

function unico(caminho: string, usados: Set<string>): string {
  if (!usados.has(caminho)) { usados.add(caminho); return caminho; }
  const m = caminho.match(/^(.*?)(\.[^./]+)?$/)!;
  for (let i = 2; ; i++) {
    const c = `${m[1]} (${i})${m[2] ?? ''}`;
    if (!usados.has(c)) { usados.add(c); return c; }
  }
}

/** O ZIP guarda a hora "de parede", sem fuso: monta a data com a hora de São Paulo, seja qual for o relógio do servidor. */
export function horaDeParedeSP(instante: Date): Date {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(instante).map((x) => [x.type, Number(x.value)]));
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const STATUS: Record<string, string> = { a_conferir: 'A conferir', nao_reconhecido: 'Não reconhecido', conferido: 'Conferido', rejeitado: 'Refazer', substituido: 'Substituído' };

export async function nomeDoZip(empresaId: string): Promise<string> {
  const e = await um<{ nome: string }>(`SELECT nome FROM empresas WHERE id = $1`, [empresaId]);
  return `${pastaSegura(e?.nome ?? 'Empresa')} - documentos ${dataSP()}.zip`;
}

export async function exportarEmpresa(empresaId: string, usuarioId: string, destino: Writable): Promise<{ exportacaoId: string; arquivos: number; falhas: number; bytes: number }> {
  const e = await um<{ nome: string; cnpj: string }>(`SELECT nome, cnpj FROM empresas WHERE id = $1`, [empresaId]);
  if (!e) throw new Error('Empresa não encontrada.');
  const exp = (await um<{ id: string }>(`INSERT INTO exportacoes (empresa_id, usuario_id) VALUES ($1, $2) RETURNING id`, [empresaId, usuarioId]))!;
  const ids = (await todos<{ id: string }>(
    `SELECT id FROM documentos WHERE empresa_id = $1 AND excluido_em IS NULL AND status NOT IN ('processando', 'recusado') ORDER BY recebido_em`, [empresaId])).map((r) => r.id);
  const raiz = pastaSegura(`${e.nome} (${e.cnpj})`);
  const zip = archiver('zip', { zlib: { level: 6 } });
  const fim = new Promise<void>((ok, falha) => { destino.on('finish', ok); destino.on('close', ok); destino.on('error', falha); zip.on('error', falha); });
  zip.pipe(destino);
  const usados = new Set<string>();
  const linhas = [['Caminho', 'Nome original', 'Tipo', 'Subtipo', 'Mês', 'Situação', 'Recebido em', 'Origem', 'Enviado por'].map(csv).join(';')];
  let arquivos = 0, falhas = 0, bytes = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const docs = await listarArquivos({ ids: lote, podeSensivel: true, incluirSubstituidos: true, limite: 1000 });
    const chaves = new Map((await todos<{ id: string; chave: string }>(`SELECT id, chave FROM documentos WHERE id = ANY($1::uuid[])`, [lote])).map((r) => [r.id, r.chave]));
    for (const d of docs) {
      const caminho = unico(caminhoNoZip(d), usados);
      let situacao = STATUS[d.status] ?? d.status;
      try {
        const dados = await armazenamento().ler(chaves.get(d.id)!);
        await new Promise<void>((ok) => { zip.once('entry', () => ok()); zip.append(dados, { name: `${raiz}/${caminho}`, date: horaDeParedeSP(new Date(d.recebido_em)) }); });
        arquivos++; bytes += dados.length;
      } catch {
        falhas++; situacao = `FALHOU: arquivo não encontrado no armazenamento (${situacao})`;
      }
      linhas.push([caminho, d.nome_original, d.tipo_nome ?? '', d.subtipo_rotulo ?? '', d.competencia ? anoMes(d.competencia) : '', situacao,
        `${dataSP(d.recebido_em)} ${horaSP(d.recebido_em)}`, d.origem, d.enviado_por ?? ''].map(csv).join(';'));
    }
    await q(`INSERT INTO acessos_documento (documento_id, acao, usuario_id) SELECT unnest($1::uuid[]), 'exportar', $2`, [docs.map((d) => d.id), usuarioId]);
  }
  zip.append(`﻿${linhas.join('\r\n')}\r\n`, { name: `${raiz}/indice.csv`, date: horaDeParedeSP(new Date()) });
  zip.append(`Documentos de ${e.nome} (CNPJ ${formatarCnpj(e.cnpj)}), exportados em ${dataSP()} às ${horaSP(new Date())}.\r\n`
    + `Pastas: Tipo / Subtipo / Mês, como no portal. "Não reconhecidos" são arquivos sem tipo identificado.\r\n`
    + `O arquivo indice.csv lista todos os documentos, com o nome original e quem enviou.\r\n`
    + (falhas ? `\r\nATENÇÃO: ${falhas} arquivo(s) não foram encontrados no armazenamento (veja indice.csv).\r\n` : ''), { name: `${raiz}/LEIA-ME.txt`, date: horaDeParedeSP(new Date()) });
  await zip.finalize();
  await fim;
  // Exportação com falha não libera a exclusão.
  await q(`UPDATE exportacoes SET arquivos = $2, bytes = $3, concluida_em = CASE WHEN $4::int = 0 THEN now() END WHERE id = $1`, [exp.id, arquivos, bytes, falhas]);
  return { exportacaoId: exp.id, arquivos, falhas, bytes };
}
