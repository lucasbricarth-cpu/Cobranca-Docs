import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { inflateRawSync } from 'node:zlib';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos, pool } from '@/lib/db';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { rodarFila } from '@/lib/fila';
import { armazenamento } from '@/lib/armazenamento';
import { aoSincronizarContas } from '@/lib/documentos/subtipos';
import { pdfDemo } from '@/lib/dev/demo-arquivos';
import { vencidos, aVencerNaPastaGeral, rodarGuarda, aprovarExclusao, excluirEmpresa, situacaoDaSaida, prazos } from '@/lib/guarda';
import { exportarEmpresa, caminhoNoZip, horaDeParedeSP } from '@/lib/guarda/exportar';
import { acessosDoDocumento } from '@/lib/documentos/consultas';
import { emailsEnviadosNoLog, limparLogDeEmails } from '@/lib/notificacoes/email';
import { rodarDiario } from '@/lib/jobs/diario';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
let itau: string;
let n = 0;

beforeAll(async () => {
  ids = await bancoLimpo();
  const c = await pool().connect();
  await aoSincronizarContas(c); c.release();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
  itau = (await um<{ id: string }>(`SELECT s.id FROM subtipos s JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE c.final = '0567'`))!.id;
});
afterAll(fecharPool);

async function processar() { while ((await rodarFila(50)) > 0) { /* até esvaziar */ } }
async function doc(o: { empresa?: string | null; tipo?: string | null; sub?: string | null; comp?: string | null; recebido?: string; nome?: string }) {
  const r = await registrarEnvio({
    dados: await pdfDemo(`Doc ${++n}`, [`conteúdo ${n} ${Date.now()}`]), nomeOriginal: o.nome ?? `arquivo-${n}.pdf`, origem: o.empresa === null ? 'whatsapp' : 'app',
    empresaId: o.empresa === undefined ? ids.empresas[101] : o.empresa, tipoId: o.tipo ?? null, subtipoId: o.sub ?? null, competencia: o.comp ?? null,
    whatsappNumero: o.empresa === null ? '5521977776666' : null,
  });
  await processar();
  if (o.recebido) await q(`UPDATE documentos SET recebido_em = $2 WHERE id = $1`, [r.id, o.recebido]);
  return r.id;
}
const chave = async (id: string) => (await um<{ chave: string }>(`SELECT chave FROM documentos WHERE id = $1`, [id]))!.chave;

/** Lê os nomes (e o conteúdo, se pedido) de um ZIP pelo diretório central. */
function lerZip(buf: Buffer): Map<string, () => Buffer> {
  const fimDir = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = buf.readUInt32LE(fimDir + 16);
  const total = buf.readUInt16LE(fimDir + 10);
  const r = new Map<string, () => Buffer>();
  for (let i = 0; i < total; i++) {
    const metodo = buf.readUInt16LE(p + 10), tam = buf.readUInt32LE(p + 20), ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const nome = buf.subarray(p + 46, p + 46 + ln).toString('utf8');
    r.set(nome, () => {
      const ini = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const dados = buf.subarray(ini, ini + tam);
      return metodo === 8 ? inflateRawSync(dados) : dados;
    });
    p += 46 + ln + le + lc;
  }
  return r;
}
async function exportar(empresaId: string) {
  const partes: Buffer[] = [];
  const destino = new Writable({ write(c, _e, cb) { partes.push(c as Buffer); cb(); } });
  const r = await exportarEmpresa(empresaId, ids.admin, destino);
  return { ...r, zip: lerZip(Buffer.concat(partes)) };
}

describe('prazo de guarda', () => {
  it('conta do fim do mês do documento, no fuso de São Paulo; pasta geral pelos dias do recebimento', async () => {
    await q(`UPDATE tipos_documento SET guarda_meses = 60 WHERE id = $1`, [tipo['Extrato bancário']]);
    const velho = await doc({ tipo: tipo['Extrato bancário'], sub: itau, comp: '2020-01-01' });
    // Vence em 01/02/2025: 60 meses depois do fim de janeiro de 2020.
    expect((await vencidos('2025-01-31')).map((d) => d.id)).not.toContain(velho);
    const v = (await vencidos('2025-02-01')).find((d) => d.id === velho)!;
    expect(v).toMatchObject({ motivo: 'guarda', vence_em: '2025-02-01' });
    // Pasta geral: 22h30 de 31/05 em São Paulo ainda é 31/05 (01/06 em UTC).
    const geral = await doc({ empresa: null, recebido: '2026-05-31T22:30:00-03:00' });
    const vence = (await aVencerNaPastaGeral('2026-08-24')).find((d) => d.id === geral);
    expect(vence?.vence_em).toBe('2026-08-29'); // 31/05 + 90 dias
    expect((await vencidos('2026-08-28', 'pasta_geral')).map((d) => d.id)).not.toContain(geral);
    expect((await vencidos('2026-08-29', 'pasta_geral')).map((d) => d.id)).toContain(geral);
    expect(prazos().pastaGeralDias).toBe(90);
  });

  it('o job só lista e avisa os Admins (uma vez por documento); nunca apaga sozinho', async () => {
    limparLogDeEmails();
    const antes = (await um<{ n: number }>(`SELECT count(*)::int AS n FROM documentos WHERE excluido_em IS NULL`))!.n;
    const r = await rodarGuarda(new Date('2026-08-25T12:00:00-03:00'));
    expect(r.vencidos).toBeGreaterThan(0);
    expect(r.aVencerPastaGeral).toBe(1);
    const emails = emailsEnviadosNoLog();
    expect(emails.map((e) => e.para)).toEqual(['ana@escritorio.com.br']);
    // Aviso genérico: só contagens, nada do conteúdo (tipo, banco, nome do arquivo).
    expect(emails[0].corpo).not.toMatch(/Extrato|Itaú|arquivo-\d|\.pdf/);
    expect((await um<{ n: number }>(`SELECT count(*)::int AS n FROM documentos WHERE excluido_em IS NULL`))!.n).toBe(antes);
    limparLogDeEmails();
    await rodarDiario(new Date('2026-08-26T12:00:00-03:00'));
    expect(emailsEnviadosNoLog().filter((e) => /Guarda/.test(e.assunto))).toHaveLength(0);
    expect((await um<{ n: number }>(`SELECT count(*)::int AS n FROM documentos WHERE excluido_em IS NULL`))!.n).toBe(antes);
  });
});

describe('exclusão aprovada por um Admin', () => {
  it('funcionário comum não aprova; documento que não venceu não sai (nem trocando o id)', async () => {
    const novo = await doc({ tipo: tipo['Extrato bancário'], sub: itau, comp: '2026-09-01' });
    const [velho] = await vencidos('2026-10-02', 'guarda');
    await expect(aprovarExclusao({ ids: [velho.id], motivo: 'guarda', usuarioId: ids.func })).rejects.toThrow(/Admin/);
    await expect(aprovarExclusao({ ids: [velho.id, novo], motivo: 'guarda', usuarioId: ids.admin, hoje: '2026-10-02' })).rejects.toThrow(/não está mais/);
    expect((await um<{ excluido_em: Date | null }>(`SELECT excluido_em FROM documentos WHERE id = $1`, [velho.id]))!.excluido_em).toBeNull();
    expect(await armazenamento().existe(await chave(velho.id))).toBe(true);
  });

  it('aprovada: apaga o arquivo e os metadados pessoais, registra quem aprovou', async () => {
    const [velho] = await vencidos('2026-10-02', 'guarda');
    const k = await chave(velho.id);
    const r = await aprovarExclusao({ ids: [velho.id], motivo: 'guarda', usuarioId: ids.admin, hoje: '2026-10-02' });
    expect(r.excluidos).toBe(1);
    expect(await armazenamento().existe(k)).toBe(false);
    const d = (await um<{ excluido_em: Date | null; excluido_por: string; nome_original: string }>(`SELECT excluido_em, excluido_por, nome_original FROM documentos WHERE id = $1`, [velho.id]))!;
    expect(d.excluido_em).not.toBeNull();
    expect(d.excluido_por).toBe(ids.admin);
    expect(d.nome_original).toBe('excluído');
    expect(await um(`SELECT 1 FROM exclusoes WHERE $1 = ANY(documentos) AND aprovado_por = $2 AND motivo = 'guarda'`, [velho.id, ids.admin])).not.toBeNull();
    expect(await um(`SELECT 1 FROM auditoria_documentos WHERE documento_id = $1 AND acao = 'excluido'`, [velho.id])).not.toBeNull();
    expect((await vencidos('2026-10-02')).map((x) => x.id)).not.toContain(velho.id);
  });
});

describe('saída de um cliente', () => {
  it('"Exportar tudo": ZIP com a árvore Tipo › Subtipo › Mês, versões anteriores, índice e registro de acesso', async () => {
    const emp = ids.empresas[103];
    await q(`INSERT INTO subtipos (empresa_id, tipo_id, nome) VALUES ($1, $2, 'Caixa') ON CONFLICT DO NOTHING`, [emp, tipo['Extrato bancário']]);
    const sub = (await um<{ id: string }>(`SELECT id FROM subtipos WHERE empresa_id = $1 AND nome = 'Caixa'`, [emp]))!.id;
    const a = await doc({ empresa: emp, tipo: tipo['Extrato bancário'], sub, comp: '2026-09-01' });
    const b = await doc({ empresa: emp, tipo: tipo['Notas fiscais de saída'], comp: '2026-08-01' });
    const c = await doc({ empresa: emp });
    await q(`UPDATE documentos SET status = 'nao_reconhecido' WHERE id = $1`, [c]);
    const r = await exportar(emp);
    expect(r).toMatchObject({ arquivos: 3, falhas: 0 });
    const nomes = [...r.zip.keys()];
    const raiz = nomes[0].split('/')[0];
    expect(raiz).toMatch(/\(\d{14}\)$/);
    expect(nomes).toEqual(expect.arrayContaining([
      `${raiz}/Extrato bancário/Caixa/2026-09 Setembro/Extrato_Caixa_2026-09.pdf`,
      `${raiz}/Notas fiscais de saída/2026-08 Agosto/Notas_fiscais_de_saida_2026-08.pdf`,
      `${raiz}/indice.csv`, `${raiz}/LEIA-ME.txt`,
    ]));
    expect(nomes.some((x) => x.startsWith(`${raiz}/Não reconhecidos/`))).toBe(true);
    // O arquivo dentro do ZIP é o mesmo que está guardado.
    const original = await armazenamento().ler(await chave(a));
    expect(r.zip.get(`${raiz}/Extrato bancário/Caixa/2026-09 Setembro/Extrato_Caixa_2026-09.pdf`)!().equals(original)).toBe(true);
    expect(r.zip.get(`${raiz}/indice.csv`)!().toString('utf8')).toMatch(/arquivo-\d+\.pdf/);
    expect((await acessosDoDocumento(b)).map((x) => x.acao)).toContain('exportar');
    expect((await situacaoDaSaida(emp)).exportacaoAtual).toBe(true);
  });

  it('a hora dos arquivos no ZIP é a de São Paulo, não a do servidor', () => {
    const h = horaDeParedeSP(new Date('2026-10-01T01:30:00Z')); // 22h30 de 30/09 em São Paulo
    expect([h.getFullYear(), h.getMonth() + 1, h.getDate(), h.getHours(), h.getMinutes()]).toEqual([2026, 9, 30, 22, 30]);
  });

  it('versões anteriores ficam numa pasta própria dentro do mês', () => {
    expect(caminhoNoZip({ tipo_nome: 'Extrato bancário', subtipo_rotulo: 'Itaú final 0567', competencia: '2026-09-01', status: 'substituido', nome_download: 'Extrato_Itau_0567_2026-09.pdf' }))
      .toBe('Extrato bancário/Itaú final 0567/2026-09 Setembro/Versões anteriores/Extrato_Itau_0567_2026-09.pdf');
  });

  it('a exclusão exige o CNPJ digitado e uma exportação que já inclui tudo o que chegou', async () => {
    const emp = ids.empresas[103];
    const cnpj = (await um<{ cnpj: string }>(`SELECT cnpj FROM empresas WHERE id = $1`, [emp]))!.cnpj;
    await expect(excluirEmpresa({ empresaId: emp, usuarioId: ids.admin, confirmacao: '00.000.000/0000-00' })).rejects.toThrow(/CNPJ/);
    // Chegou arquivo depois da exportação: precisa exportar de novo.
    await new Promise((ok) => setTimeout(ok, 20));
    const depois = await doc({ empresa: emp, tipo: tipo['Notas fiscais de entrada'], comp: '2026-09-01' });
    await expect(excluirEmpresa({ empresaId: emp, usuarioId: ids.admin, confirmacao: cnpj })).rejects.toThrow(/Exporte/);
    await expect(excluirEmpresa({ empresaId: emp, usuarioId: ids.func, confirmacao: cnpj })).rejects.toThrow();
    await exportar(emp);
    const outra = await doc({ tipo: tipo['Notas fiscais de entrada'], comp: '2026-07-01' }); // empresa 101: não pode sair junto
    const r = await excluirEmpresa({ empresaId: emp, usuarioId: ids.admin, confirmacao: cnpj });
    expect(r.excluidos).toBe(4);
    expect((await um<{ n: number }>(`SELECT count(*)::int AS n FROM documentos WHERE empresa_id = $1 AND excluido_em IS NULL AND status <> 'recusado'`, [emp]))!.n).toBe(0);
    expect(await armazenamento().existe(await chave(depois))).toBe(false);
    expect(await armazenamento().existe(await chave(outra))).toBe(true);
    expect((await situacaoDaSaida(emp)).saida_em).not.toBeNull();
  });

  it('pasta geral: a exclusão aprovada pelo motivo certo', async () => {
    const [g] = await vencidos('2026-12-01', 'pasta_geral');
    await expect(aprovarExclusao({ ids: [g.id], motivo: 'guarda', usuarioId: ids.admin, hoje: '2026-12-01' })).rejects.toThrow();
    expect((await aprovarExclusao({ ids: [g.id], motivo: 'pasta_geral', usuarioId: ids.admin, hoje: '2026-12-01' })).excluidos).toBe(1);
  });
});
