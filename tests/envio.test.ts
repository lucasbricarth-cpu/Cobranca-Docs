import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos } from '@/lib/db';
import { armazenamento } from '@/lib/armazenamento';
import { opcoesDeMes, resolverMes } from '@/lib/envio/mes';
import { iniciarEnvio, analisarEnvio, confirmarEnvio, mudarEmpresaDoEnvio } from '@/lib/envio/servico';
import { atorDoLink, criarLinkEnvio, type Ator } from '@/lib/envio/ator';
import { rodarFila } from '@/lib/fila';
import { pdfDemo, xmlNfeDemo } from '@/lib/dev/demo-arquivos';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
let itau: string;
let carlos: Ator;      // Padaria + Consultório
let silva: Ator;       // só a Oficina
beforeAll(async () => {
  ids = await bancoLimpo();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
  itau = (await um<{ id: string }>(`SELECT s.id FROM subtipos s JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE c.final = '0567'`))!.id;
  const emp = await todos<{ id: string; nome: string; cnpj: string; codi_emp: number }>(`SELECT id, nome, cnpj, codi_emp FROM empresas ORDER BY codi_emp`);
  carlos = { loginId: ids.login, nome: 'Carlos Padeiro', empresas: emp.filter((e) => [101, 103].includes(e.codi_emp)) };
  silva = { loginId: ids.login2, nome: 'Dona Silva', empresas: emp.filter((e) => e.codi_emp === 102) };
});
afterAll(fecharPool);

async function subir(ator: Ator, dados: Buffer, nome = 'doc.pdf', itemId: string | null = null) {
  const u = await iniciarEnvio(ator, { nomeOriginal: nome, mime: 'application/pdf', itemId });
  const { chave } = (await um<{ chave: string }>(`SELECT chave FROM uploads WHERE id = $1`, [u.uploadId]))!;
  await armazenamento().salvar(chave, dados, 'application/pdf');
  return u.uploadId;
}
const item = async (empresa: string, tipoNome: string, sub: string | null, comp: string) =>
  (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, subtipo_id, competencia, prazo) VALUES ($1, $2, $3, $4, '2026-10-05') RETURNING id`, [empresa, tipo[tipoNome], sub, comp]))!.id;

describe('regra do mês', () => {
  it('com pedido: é o mês do pedido, sem leitura', async () => {
    const i = await item(ids.empresas[101], 'Guias e comprovantes', null, '2026-06-01');
    expect(await opcoesDeMes({ itemId: i, empresaId: ids.empresas[101], tipoId: tipo['Guias e comprovantes'], subtipoId: null })).toEqual({ modo: 'pedido', itemId: i, competencia: '2026-06-01' });
  });
  it('sem pedido e um único item aberto: o arquivo vai para esse item', async () => {
    const i = await item(ids.empresas[101], 'Extrato bancário', itau, '2026-08-01');
    expect(await opcoesDeMes({ empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: itau })).toEqual({ modo: 'item', itemId: i, competencia: '2026-08-01' });
  });
  it('sem pedido e dois itens abertos: obriga a escolher, nada marcado', async () => {
    await item(ids.empresas[101], 'Extrato bancário', itau, '2026-09-01');
    const o = await opcoesDeMes({ empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: itau });
    expect(o.modo).toBe('escolher');
    expect(o.modo === 'escolher' && o.meses.map((m) => m.competencia)).toEqual(['2026-08-01', '2026-09-01']);
    await expect(resolverMes({ empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: itau, competenciaEscolhida: null })).rejects.toThrow(/qual mês/);
    expect((await resolverMes({ empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: itau, competenciaEscolhida: '2026-09-01' })).competencia).toBe('2026-09-01');
  });
  it('sem pedido e sem item aberto: vale a regra do tipo (anterior / atual)', async () => {
    const agora = new Date('2026-10-15T15:00:00Z');
    expect(await opcoesDeMes({ empresaId: ids.empresas[102], tipoId: tipo['Notas fiscais de entrada'], subtipoId: null, agora })).toEqual({ modo: 'regra', competencia: '2026-09-01' });
    expect(await opcoesDeMes({ empresaId: ids.empresas[102], tipoId: tipo['Contratos e alterações'], subtipoId: null, agora })).toEqual({ modo: 'regra', competencia: '2026-10-01' });
  });
  it('envio às 22h do último dia do mês, no fuso de São Paulo, conta no próprio mês', async () => {
    const agora = new Date('2026-11-01T01:00:00Z'); // 31/10/2026 22:00 em São Paulo
    expect(await opcoesDeMes({ empresaId: ids.empresas[102], tipoId: tipo['Notas fiscais de entrada'], subtipoId: null, agora })).toEqual({ modo: 'regra', competencia: '2026-09-01' });
    expect(await opcoesDeMes({ empresaId: ids.empresas[102], tipoId: tipo['Contratos e alterações'], subtipoId: null, agora })).toEqual({ modo: 'regra', competencia: '2026-10-01' });
    await expect(resolverMes({ empresaId: ids.empresas[102], tipoId: tipo['Contratos e alterações'], subtipoId: null, competenciaEscolhida: '2026-11-01', agora })).rejects.toThrow(/futuro/);
  });
});

describe('isolamento no envio', () => {
  it('um login da empresa A não envia para a empresa B, nem trocando o id na requisição', async () => {
    const up = await subir(silva, await pdfDemo('Oficina', ['x']));
    await analisarEnvio(silva, up, { sensivel: false });
    await expect(confirmarEnvio(silva, { uploadId: up, empresaId: ids.empresas[101], tipoId: tipo['Outros'], subtipoId: null })).rejects.toThrow(/vínculos/);
    // nem pelo item de outra empresa
    const iB = await item(ids.empresas[101], 'Contratos e alterações', null, '2026-05-01');
    await expect(iniciarEnvio(silva, { nomeOriginal: 'a.pdf', mime: 'application/pdf', itemId: iB })).rejects.toThrow(/vínculos/);
    // nem lendo o upload de outro login
    await expect(analisarEnvio(carlos, up, { sensivel: false })).rejects.toThrow(/não encontrado/);
  });

  it('o link de envio só envia para o pedido e a empresa dele', async () => {
    const i1 = await item(ids.empresas[101], 'Folha: ponto e eventos', null, '2026-09-01');
    const i2 = await item(ids.empresas[101], 'Folha: ponto e eventos', null, '2026-08-01');
    const token = await criarLinkEnvio({ loginId: ids.login, empresaId: ids.empresas[101], itemId: i1, origem: 'whatsapp' });
    const ator = (await atorDoLink(token))!;
    expect(ator.empresas.map((e) => e.id)).toEqual([ids.empresas[101]]);
    await expect(iniciarEnvio(ator, { nomeOriginal: 'a.pdf', mime: 'application/pdf', itemId: i2 })).rejects.toThrow(/só envia para o pedido/);
    // link de uma empresa fora dos vínculos nem nasce
    await expect(criarLinkEnvio({ loginId: ids.login, empresaId: ids.empresas[102], itemId: null, origem: 'qr' })).rejects.toThrow(/vínculos/);
    // link expirado não vale
    await q(`UPDATE links_envio SET expira_em = now() - interval '1 minute'`);
    expect(await atorDoLink(token)).toBeNull();
  });
});

describe('popup de confirmação e envio', () => {
  it('empresa vem marcada só quando o CNPJ lido bate exatamente com uma do login', async () => {
    const up = await subir(carlos, xmlNfeDemo('45723174000110', '11222333000181', '2026-09-10', 77), 'nota.xml');
    const a = await analisarEnvio(carlos, up, { sensivel: false });
    expect(a.cnpjs).toContain('11222333000181');
    expect(a.empresaSugerida).toBe(ids.empresas[101]);
    const up2 = await subir(carlos, await pdfDemo('Sem CNPJ', ['nada aqui']));
    expect((await analisarEnvio(carlos, up2, { sensivel: false })).empresaSugerida).toBeNull();
  });

  it('sem pedido, um arquivo que passou pela análise não pode virar sensível depois', async () => {
    const up = await subir(carlos, await pdfDemo('Atestado?', ['x']));
    await analisarEnvio(carlos, up, { sensivel: false });
    await expect(confirmarEnvio(carlos, { uploadId: up, empresaId: ids.empresas[101], tipoId: tipo['Atestados e exames de funcionário'], subtipoId: null }))
      .rejects.toThrow(/sensível/);
  });

  it('envia, mostra a empresa, e "Mudar empresa" só vale até o escritório conferir', async () => {
    const up = await subir(carlos, await pdfDemo('Contrato', ['alteração']));
    await analisarEnvio(carlos, up, { sensivel: false });
    const r = await confirmarEnvio(carlos, { uploadId: up, empresaId: ids.empresas[101], tipoId: tipo['Contratos e alterações'], subtipoId: null, competencia: null }, new Date('2026-10-10T12:00:00Z'));
    expect(r.empresaNome).toBe('Padaria do Bairro Ltda');
    while ((await rodarFila(20)) > 0) { /* processa */ }
    await mudarEmpresaDoEnvio(carlos, r.documentoId, ids.empresas[103]);
    const d = await um<{ empresa_id: string; status: string }>(`SELECT empresa_id, status FROM documentos WHERE id = $1`, [r.documentoId]);
    expect(d).toEqual({ empresa_id: ids.empresas[103], status: 'a_conferir' });
    const aud = await um<{ acao: string; quem: string }>(`SELECT acao, quem FROM auditoria_documentos WHERE documento_id = $1`, [r.documentoId]);
    expect(aud).toEqual({ acao: 'empresa_trocada_cliente', quem: 'Carlos Padeiro' });
    await q(`UPDATE documentos SET status = 'conferido' WHERE id = $1`, [r.documentoId]);
    await expect(mudarEmpresaDoEnvio(carlos, r.documentoId, ids.empresas[101])).rejects.toThrow(/já conferiu/);
    // e nunca para empresa fora dos vínculos
    await expect(mudarEmpresaDoEnvio(carlos, r.documentoId, ids.empresas[102])).rejects.toThrow(/vínculos/);
  });

  it('com pedido: o arquivo entra no item e o item fica Recebido', async () => {
    const i = await item(ids.empresas[103], 'Notas fiscais de saída', null, '2026-09-01');
    const up = await subir(carlos, await pdfDemo('Notas', ['saída']), 'notas.pdf', i);
    await analisarEnvio(carlos, up, { sensivel: false });
    await confirmarEnvio(carlos, { uploadId: up, empresaId: ids.empresas[101] /* ignorado: vale o do pedido */, tipoId: tipo['Outros'], subtipoId: null });
    while ((await rodarFila(20)) > 0) { /* processa */ }
    const it = await um<{ status: string; documento_id: string }>(`SELECT status, documento_id FROM itens_pedido WHERE id = $1`, [i]);
    expect(it?.status).toBe('recebido');
    const d = await um<{ empresa_id: string; tipo_id: string; com_pedido: boolean }>(`SELECT empresa_id, tipo_id, com_pedido FROM documentos WHERE id = $1`, [it!.documento_id]);
    expect(d).toEqual({ empresa_id: ids.empresas[103], tipo_id: tipo['Notas fiscais de saída'], com_pedido: true });
  });
});
