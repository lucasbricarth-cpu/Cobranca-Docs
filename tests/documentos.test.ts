import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos } from '@/lib/db';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { rodarFila } from '@/lib/fila';
import { classificarDocumento, rejeitarDocumento } from '@/lib/documentos/acoes';
import { listarArquivos, checklistDoMes, resumoDoMes } from '@/lib/documentos/consultas';
import { nomeGerado, nomeDoDownload } from '@/lib/documentos/nomes';
import { podeAbrir } from '@/lib/documentos/permissao';
import { renomearSubtipo, aoSincronizarContas } from '@/lib/documentos/subtipos';
import { pdfDemo, fotoDemo } from '@/lib/dev/demo-arquivos';
import { pool } from '@/lib/db';
import type { Funcionario, Cliente } from '@/lib/auth/sessao';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
let itau: string;
const admin = (): Funcionario => ({ tipo: 'funcionario', id: ids.admin, nome: 'Ana Lima', email: 'ana@escritorio.com.br', papel: 'admin' });
const bruno = (): Funcionario => ({ tipo: 'funcionario', id: ids.func, nome: 'Bruno Costa', email: 'bruno@escritorio.com.br', papel: 'funcionario' });

beforeAll(async () => {
  ids = await bancoLimpo();
  const c = await pool().connect();
  await aoSincronizarContas(c); c.release();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
  itau = (await um<{ id: string }>(`SELECT s.id FROM subtipos s JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE c.final = '0567'`))!.id;
});
afterAll(fecharPool);

async function processar() { while ((await rodarFila(50)) > 0) { /* até esvaziar */ } }

describe('nomes gerados na hora', () => {
  it('nome de tela e de download (sem acento, ano antes do mês)', () => {
    const base = { tipo_nome: 'Extrato bancário', subtipo: { codigo_banco: '341', conta_final: '0567' }, competencia: '2026-09-01', nome_original: 'x.pdf', extensao: 'pdf' };
    expect(nomeGerado(base)).toBe('Extrato Itaú 0567 · Set/2026');
    expect(nomeDoDownload(base)).toBe('Extrato_Itau_0567_2026-09.pdf');
    expect(nomeDoDownload({ ...base, tipo_nome: 'Notas fiscais de saída', subtipo: null })).toBe('Notas_fiscais_de_saida_2026-09.pdf');
  });
  it('renomear o subtipo muda o nome de todos os arquivos (o nome não é gravado)', async () => {
    const r = await registrarEnvio({ dados: await pdfDemo('Itaú', ['a']), nomeOriginal: 'a.pdf', origem: 'app', empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: itau, competencia: '2026-09-01' });
    await processar();
    await renomearSubtipo(itau, 'Itaú Principal');
    const [a] = await listarArquivos({ ids: [r.id], podeSensivel: true });
    expect(a.nome).toBe('Extrato Itaú Principal · Set/2026');
    await renomearSubtipo(itau, null);
  });
});

describe('recebimento', () => {
  it('o mesmo arquivo na mesma empresa não vira dois documentos', async () => {
    const dados = await pdfDemo('Duplicado', ['x']);
    const a = await registrarEnvio({ dados, nomeOriginal: 'd1.pdf', origem: 'app', empresaId: ids.empresas[101] });
    const b = await registrarEnvio({ dados, nomeOriginal: 'd2.pdf', origem: 'whatsapp', empresaId: ids.empresas[101] });
    expect(b.duplicado).toBe(true);
    expect(b.id).toBe(a.id);
    const c = await registrarEnvio({ dados, nomeOriginal: 'd3.pdf', origem: 'app', empresaId: ids.empresas[102] });
    expect(c.duplicado).toBe(false);
  });

  it('só aparece na pasta depois do processamento; gera miniatura; sensível nunca tem miniatura', async () => {
    const normal = await registrarEnvio({ dados: await fotoDemo('Recibo'), nomeOriginal: 'r.jpg', origem: 'app', empresaId: ids.empresas[101], tipoId: tipo['Guias e comprovantes'], competencia: '2026-09-01' });
    const sens = await registrarEnvio({ dados: await fotoDemo('Atestado'), nomeOriginal: 'at.jpg', origem: 'app', empresaId: ids.empresas[101], tipoId: tipo['Atestados e exames de funcionário'], competencia: '2026-09-01' });
    expect((await listarArquivos({ ids: [normal.id], podeSensivel: true }))).toHaveLength(0);
    await processar();
    const d1 = await um<{ status: string; miniatura_chave: string | null; mime: string }>(`SELECT status, miniatura_chave, mime FROM documentos WHERE id = $1`, [normal.id]);
    expect(d1).toMatchObject({ status: 'a_conferir', mime: 'image/jpeg' });
    expect(d1?.miniatura_chave).toBeTruthy();
    const d2 = await um<{ miniatura_chave: string | null }>(`SELECT miniatura_chave FROM documentos WHERE id = $1`, [sens.id]);
    expect(d2?.miniatura_chave).toBeNull();
  });

  it('PDF gera miniatura da primeira página', async () => {
    const r = await registrarEnvio({ dados: await pdfDemo('Miniatura', ['p1']), nomeOriginal: 'm.pdf', origem: 'app', empresaId: ids.empresas[103] });
    await processar();
    const d = await um<{ miniatura_chave: string | null; paginas: number | null; status: string }>(`SELECT miniatura_chave, paginas, status FROM documentos WHERE id = $1`, [r.id]);
    expect(d?.miniatura_chave).toBeTruthy();
    expect(d?.paginas).toBe(1);
    expect(d?.status).toBe('nao_reconhecido'); // sem tipo
  });
});

describe('itens, versões e auditoria', () => {
  it('um arquivo novo para o mesmo item vira o atual e o anterior fica Substituído', async () => {
    const item = (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, subtipo_id, competencia, prazo) VALUES ($1, $2, $3, '2026-08-01', '2026-09-05') RETURNING id`, [ids.empresas[101], tipo['Extrato bancário'], itau]))!.id;
    const v1 = await registrarEnvio({ dados: await pdfDemo('v1', ['1']), nomeOriginal: 'v1.pdf', origem: 'app', empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: itau, competencia: '2026-08-01', itemId: item });
    await processar();
    const v2 = await registrarEnvio({ dados: await pdfDemo('v2', ['2']), nomeOriginal: 'v2.pdf', origem: 'app', empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: itau, competencia: '2026-08-01', itemId: item });
    await processar();
    const d1 = await um<{ status: string; substituido_por: string }>(`SELECT status, substituido_por FROM documentos WHERE id = $1`, [v1.id]);
    expect(d1).toEqual({ status: 'substituido', substituido_por: v2.id });
    const it = await um<{ status: string; documento_id: string }>(`SELECT status, documento_id FROM itens_pedido WHERE id = $1`, [item]);
    expect(it).toEqual({ status: 'recebido', documento_id: v2.id });
    // "Recebido não é pronto": o mês só completa quando tudo está conferido.
    const r = resumoDoMes(await checklistDoMes(ids.empresas[101], '2026-08-01'));
    expect(r).toMatchObject({ total: 1, recebidos: 1, conferidos: 0, completo: false });
  });

  it('classificar registra quem, de quê para quê e quando; rejeitar reabre o item como Refazer', async () => {
    const d = await registrarEnvio({ dados: await pdfDemo('sem tipo', ['?']), nomeOriginal: 'scan.pdf', origem: 'app', empresaId: ids.empresas[101] });
    await processar();
    const item = (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, competencia) VALUES ($1, $2, '2026-07-01') RETURNING id`, [ids.empresas[101], tipo['Notas fiscais de entrada']]))!.id;
    await classificarDocumento(d.id, { empresaId: ids.empresas[101], tipoId: tipo['Notas fiscais de entrada'], subtipoId: null, competencia: '2026-07-01' }, admin(), true);
    const aud = await todos<{ acao: string; de: Record<string, unknown>; para: Record<string, unknown>; quem: string }>(`SELECT acao, de, para, quem FROM auditoria_documentos WHERE documento_id = $1 ORDER BY id`, [d.id]);
    expect(aud[0]).toMatchObject({ acao: 'classificado', quem: 'Ana Lima', de: { tipo_id: null }, para: { tipo_id: tipo['Notas fiscais de entrada'], competencia: '2026-07-01' } });
    expect(aud[1].acao).toBe('conferido');
    expect((await um<{ status: string; documento_id: string }>(`SELECT status, documento_id FROM itens_pedido WHERE id = $1`, [item]))).toEqual({ status: 'conferido', documento_id: d.id });
    await rejeitarDocumento(d.id, 'A foto ficou ilegível.', admin());
    expect((await um<{ status: string; motivo_refazer: string }>(`SELECT status, motivo_refazer FROM itens_pedido WHERE id = $1`, [item]))).toEqual({ status: 'refazer', motivo_refazer: 'A foto ficou ilegível.' });
  });
});

describe('permissões', () => {
  it('sensível: Admin e responsável da folha da empresa; outros funcionários e outros clientes não', async () => {
    const doc = { empresa_id: ids.empresas[103], sensivel: true, enviado_por_login: null };
    expect(await podeAbrir(admin(), doc)).toBe(true);
    expect(await podeAbrir(bruno(), doc)).toBe(false); // Bruno é da folha só da Padaria
    expect(await podeAbrir(bruno(), { ...doc, empresa_id: ids.empresas[101] })).toBe(true);
    const cli: Cliente = { tipo: 'cliente', id: ids.login, nome: 'C', email: 'c', empresas: [{ id: ids.empresas[101], nome: 'P', cnpj: '' }] };
    expect(await podeAbrir(cli, { empresa_id: ids.empresas[101], sensivel: false, enviado_por_login: null })).toBe(true);
    expect(await podeAbrir(cli, { empresa_id: ids.empresas[102], sensivel: false, enviado_por_login: null })).toBe(false);
    expect(await podeAbrir(cli, { empresa_id: ids.empresas[101], sensivel: true, enviado_por_login: null })).toBe(false);
    expect(await podeAbrir(cli, { empresa_id: ids.empresas[101], sensivel: true, enviado_por_login: ids.login })).toBe(true);
  });
  it('pasta geral (sem empresa): só Admins e responsáveis', async () => {
    const semEmpresa = { empresa_id: null, sensivel: false, enviado_por_login: null };
    expect(await podeAbrir(admin(), semEmpresa)).toBe(true);
    expect(await podeAbrir(bruno(), semEmpresa)).toBe(true); // Bruno é responsável de empresas
    await q(`INSERT INTO usuarios (nome, email, papel) VALUES ('Estagiário', 'est@escritorio.com.br', 'funcionario')`);
    const est = (await um<{ id: string }>(`SELECT id FROM usuarios WHERE email = 'est@escritorio.com.br'`))!.id;
    expect(await podeAbrir({ ...bruno(), id: est }, semEmpresa)).toBe(false);
  });
});
