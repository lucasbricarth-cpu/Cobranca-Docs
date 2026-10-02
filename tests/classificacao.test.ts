import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos } from '@/lib/db';
import { armazenamento } from '@/lib/armazenamento';
import { lerNfe } from '@/lib/classificacao/xml';
import { lerOfx } from '@/lib/classificacao/ofx';
import { decidirSubtipo, sugerirParaEnvio, taxaDeAcerto } from '@/lib/classificacao';
import { classificarDocumento, chamadasIA, SensivelNaIA } from '@/lib/classificacao/ia';
import { detectarTipo } from '@/lib/seguranca/tipo-arquivo';
import { iniciarEnvio, analisarEnvio, confirmarEnvio } from '@/lib/envio/servico';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { conferirDocumento, classificarDocumento as classificarDoc } from '@/lib/documentos/acoes';
import { rodarFila } from '@/lib/fila';
import { pdfDemo, fotoDemo, xmlNfeDemo, ofxDemo } from '@/lib/dev/demo-arquivos';
import type { Ator } from '@/lib/envio/ator';
import type { Funcionario } from '@/lib/auth/sessao';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
let itau: string, sicredi: string;
let carlos: Ator;
const processar = async () => { while ((await rodarFila(20)) > 0) { /* esvazia */ } };
const admin = (): Funcionario => ({ tipo: 'funcionario', id: ids.admin, nome: 'Ana Lima', email: 'a', papel: 'admin' });

beforeAll(async () => {
  ids = await bancoLimpo();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
  const sub = async (f: string) => (await um<{ id: string }>(`SELECT s.id FROM subtipos s JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE c.final = $1`, [f]))!.id;
  itau = await sub('0567'); sicredi = await sub('0921');
  const emp = await todos<{ id: string; nome: string; cnpj: string; codi_emp: number }>(`SELECT id, nome, cnpj, codi_emp FROM empresas`);
  carlos = { loginId: ids.login, nome: 'Carlos', empresas: emp.filter((e) => [101, 103].includes(e.codi_emp)) };
});
afterAll(fecharPool);
beforeEach(() => { process.env.IA = 'simulada'; });

describe('sem IA: XML de NF-e e OFX', () => {
  it('lê CNPJs e a data de emissão da NF-e', () => {
    expect(lerNfe(xmlNfeDemo('45723174000110', '11222333000181', '2026-09-12', 4471))).toEqual({ emitente: '45723174000110', destinatario: '11222333000181', emissao: '2026-09-12', numero: '4471' });
  });
  it('lê banco, agência, conta e período do OFX', () => {
    expect(lerOfx(ofxDemo('341', '0912', '1056-7', '2026-09-01', '2026-09-30'))).toEqual({ banco: '341', agencia: '0912', conta: '1056-7', inicio: '2026-09-01', fim: '2026-09-30' });
  });
  it('NF-e: entrada ou saída pelo CNPJ da empresa; aviso na hora se o mês não bate com o pedido', async () => {
    const dados = xmlNfeDemo('45723174000110', '11222333000181', '2026-08-20', 1);
    const r = await sugerirParaEnvio({ dados, tipoReal: detectarTipo(dados)!, empresaId: ids.empresas[101], empresasDoLogin: [], cnpjs: [], item: { tipoId: tipo['Notas fiscais de entrada'], subtipoId: null, competencia: '2026-09-01' } });
    expect(r.sugestao).toMatchObject({ tipoId: tipo['Notas fiscais de entrada'], origem: 'xml', competenciaLida: '2026-08-01' });
    expect(r.aviso).toMatch(/agosto\/2026.*setembro\/2026/);
    const saida = xmlNfeDemo('11222333000181', '45723174000110', '2026-09-20', 2);
    expect((await sugerirParaEnvio({ dados: saida, tipoReal: detectarTipo(saida)!, empresaId: ids.empresas[101], empresasDoLogin: [], cnpjs: [], item: null })).sugestao?.tipoId).toBe(tipo['Notas fiscais de saída']);
  });
  it('OFX: o código decide a conta pelo banco e pelo final; conta fora da lista vira "Nova conta encontrada"', async () => {
    const d = ofxDemo('748', '0710', '12092-1', '2026-09-01', '2026-09-30');
    const r = await sugerirParaEnvio({ dados: d, tipoReal: detectarTipo(d)!, empresaId: ids.empresas[101], empresasDoLogin: [], cnpjs: [], item: null });
    expect(r.sugestao).toMatchObject({ tipoId: tipo['Extrato bancário'], subtipoId: sicredi, origem: 'ofx', competenciaLida: '2026-09-01' });
    const n = ofxDemo('237', '1', '99887-6', '2026-09-01', '2026-09-30');
    const r2 = await sugerirParaEnvio({ dados: n, tipoReal: detectarTipo(n)!, empresaId: ids.empresas[101], empresasDoLogin: [], cnpjs: [], item: null });
    expect(r2.sugestao).toMatchObject({ subtipoId: null, novaConta: 'Bradesco final 8876' });
  });
});

describe('IA: só tipo e subtipo; o código decide a subpasta', () => {
  it('bateu com um subtipo só: encaixa; com mais de um ou nenhum: não encaixa', () => {
    const subs = [
      { id: 'a', tipo_id: 't', codigo_banco: '001', conta_final: '3310' },
      { id: 'b', tipo_id: 't', codigo_banco: '001', conta_final: '1200' },
      { id: 'c', tipo_id: 't', codigo_banco: '341', conta_final: '0567' },
    ];
    expect(decidirSubtipo({ banco: 'Banco do Brasil', final_conta: '3310', final_cartao: null }, subs, 't')).toEqual({ subtipoId: 'a', novaConta: null });
    expect(decidirSubtipo({ banco: 'Itaú Unibanco', final_conta: '1056-7', final_cartao: null }, subs, 't')).toEqual({ subtipoId: 'c', novaConta: null });
    expect(decidirSubtipo({ banco: 'Banco do Brasil', final_conta: null, final_cartao: null }, subs, 't')).toEqual({ subtipoId: null, novaConta: null });
    expect(decidirSubtipo({ banco: 'Itaú', final_conta: '9999', final_cartao: null }, subs, 't').novaConta).toBe('Itaú final 9999');
  });
  it('PDF de extrato: a IA (simulada) diz o tipo e o banco; o código acha a conta', async () => {
    const d = await pdfDemo('Itaú · Extrato', ['Agência 0912  Conta 1056-7', 'CNPJ 11.222.333/0001-81']);
    const r = await sugerirParaEnvio({ dados: d, tipoReal: detectarTipo(d)!, empresaId: ids.empresas[101], empresasDoLogin: [], cnpjs: [], item: null });
    expect(r.sugestao).toMatchObject({ tipoId: tipo['Extrato bancário'], subtipoId: itau, origem: 'ia' });
    expect(r.sugestao?.rotulo).toBe('Extrato bancário › Itaú final 0567');
    expect(r.cnpjs).toContain('11222333000181');
  });
  it('se a IA demorar ou falhar, o envio segue sem sugestão', async () => {
    process.env.IA = 'gemini'; process.env.VERTEX_PROJECT = 'x'; process.env.VERTEX_ACCESS_TOKEN = 'invalido';
    process.env.IA_PRAZO_MS = '300';
    const d = await pdfDemo('Algo', ['x']);
    const r = await classificarDocumento({ arquivo: d, mime: 'application/pdf', tipos: [{ id: '1', nome: 'Outros' }], subtipos: [] });
    expect(r).toBeNull();
    delete process.env.IA_PRAZO_MS;
  });
});

describe('nenhum tipo sensível chega à função classificarDocumento', () => {
  it('a própria função recusa a marca de sensível', async () => {
    await expect(classificarDocumento({ arquivo: Buffer.from('x'), mime: 'application/pdf', tipos: [], subtipos: [], sensivel: true } as never)).rejects.toThrow(SensivelNaIA);
  });
  it('envio do cliente marcado como sensível: a análise não chama a IA', async () => {
    const antes = chamadasIA.total;
    const u = await iniciarEnvio(carlos, { nomeOriginal: 'at.jpg', mime: 'image/jpeg' });
    const { chave } = (await um<{ chave: string }>(`SELECT chave FROM uploads WHERE id = $1`, [u.uploadId]))!;
    await armazenamento().salvar(chave, await fotoDemo('Atestado'), 'image/jpeg');
    const a = await analisarEnvio(carlos, u.uploadId, { sensivel: true });
    expect(a.sugestao).toBeNull();
    await confirmarEnvio(carlos, { uploadId: u.uploadId, empresaId: ids.empresas[101], tipoId: tipo['Atestados e exames de funcionário'], subtipoId: null });
    await processar();
    expect(chamadasIA.total).toBe(antes);
  });
  it('pedido de tipo sensível e arquivo sensível vindo de fora (WhatsApp/escritório) também não', async () => {
    const antes = chamadasIA.total;
    const item = (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, competencia) VALUES ($1, $2, '2026-09-01') RETURNING id`, [ids.empresas[101], tipo['Contribuição sindical']]))!.id;
    const u = await iniciarEnvio(carlos, { nomeOriginal: 'sind.pdf', mime: 'application/pdf', itemId: item });
    const { chave } = (await um<{ chave: string }>(`SELECT chave FROM uploads WHERE id = $1`, [u.uploadId]))!;
    await armazenamento().salvar(chave, await pdfDemo('Sindicato', ['guia']), 'application/pdf');
    await analisarEnvio(carlos, u.uploadId, { sensivel: false }); // o pedido é sensível: vale o do pedido
    await registrarEnvio({ dados: await pdfDemo('Exame', ['admissional']), nomeOriginal: 'exame.pdf', origem: 'whatsapp', empresaId: ids.empresas[101], tipoId: tipo['Atestados e exames de funcionário'], sensivel: true });
    await processar();
    expect(chamadasIA.total).toBe(antes);
    for (const e of chamadasIA.ultimas) expect(e.tipos.some((t) => t.nome.startsWith('Atestados') || t.nome === 'Contribuição sindical')).toBe(false);
  });
});

describe('arquivamento automático e acerto por tipo', () => {
  async function enviarComPedido(dados: Buffer, nome: string, sub: string | null, comp: string) {
    const item = (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, subtipo_id, competencia) VALUES ($1, $2, $3, $4) RETURNING id`, [ids.empresas[101], tipo['Extrato bancário'], sub, comp]))!.id;
    const u = await iniciarEnvio(carlos, { nomeOriginal: nome, mime: 'application/pdf', itemId: item });
    const { chave } = (await um<{ chave: string }>(`SELECT chave FROM uploads WHERE id = $1`, [u.uploadId]))!;
    await armazenamento().salvar(chave, dados, 'application/pdf');
    await analisarEnvio(carlos, u.uploadId, { sensivel: false });
    const r = await confirmarEnvio(carlos, { uploadId: u.uploadId, empresaId: ids.empresas[101], tipoId: tipo['Extrato bancário'], subtipoId: sub });
    await processar();
    return (await um<{ status: string }>(`SELECT status FROM documentos WHERE id = $1`, [r.documentoId]))!.status;
  }
  const extrato = (comp: string) => pdfDemo('Itaú · Extrato', ['Agência 0912  Conta 1056-7', 'PADARIA  CNPJ 11.222.333/0001-81', comp]);

  it('começa desligado: tudo passa por A conferir', async () => {
    expect(await enviarComPedido(await extrato('jan'), 'jan.pdf', itau, '2026-01-01')).toBe('a_conferir');
  });
  it('ligado: confere sozinho com pedido, CNPJ da empresa, tipo e subtipo do pedido', async () => {
    await q(`UPDATE tipos_documento SET arquivamento_automatico = true WHERE id = $1`, [tipo['Extrato bancário']]);
    expect(await enviarComPedido(await extrato('fev'), 'fev.pdf', itau, '2026-02-01')).toBe('conferido');
    // subtipo diferente do pedido (o PDF é do Itaú, o pedido é do Sicredi): vai para A conferir
    expect(await enviarComPedido(await extrato('mar'), 'mar.pdf', sicredi, '2026-03-01')).toBe('a_conferir');
    // sem CNPJ no documento: A conferir
    expect(await enviarComPedido(await pdfDemo('Itaú · Extrato', ['Conta 1056-7', 'abr']), 'abr.pdf', itau, '2026-04-01')).toBe('a_conferir');
  });
  it('foto ou PDF SEM pedido nunca é conferido sozinho', async () => {
    const r = await registrarEnvio({ dados: await extrato('mai'), nomeOriginal: 'mai.pdf', origem: 'app', empresaId: ids.empresas[101], loginId: ids.login, tipoId: tipo['Extrato bancário'], subtipoId: itau, competencia: '2026-05-01' });
    await processar();
    expect((await um<{ status: string }>(`SELECT status FROM documentos WHERE id = $1`, [r.id]))!.status).toBe('a_conferir');
    await q(`UPDATE tipos_documento SET arquivamento_automatico = false`);
  });
  it('cada correção do funcionário é guardada e vira a taxa de acerto por tipo', async () => {
    const certo = await registrarEnvio({ dados: await extrato('jun'), nomeOriginal: 'jun.pdf', origem: 'whatsapp', empresaId: ids.empresas[101], competencia: '2026-06-01' });
    const errado = await registrarEnvio({ dados: await pdfDemo('Fatura do cartão', ['final 3310', 'Itaú']), nomeOriginal: 'x.pdf', origem: 'whatsapp', empresaId: ids.empresas[101], competencia: '2026-06-01' });
    await processar();
    await conferirDocumento(certo.id, admin());
    // a IA disse "Fatura", o funcionário corrigiu para Guias
    await classificarDoc(errado.id, { empresaId: ids.empresas[101], tipoId: tipo['Guias e comprovantes'], subtipoId: null, competencia: '2026-06-01' }, admin(), true);
    const cs = await todos<{ acertou_tipo: boolean; origem: string }>(`SELECT acertou_tipo, origem FROM correcoes_classificacao WHERE documento_id = ANY($1) ORDER BY acertou_tipo DESC`, [[certo.id, errado.id]]);
    expect(cs).toEqual([{ acertou_tipo: true, origem: 'ia' }, { acertou_tipo: false, origem: 'ia' }]);
    const taxa = await taxaDeAcerto();
    expect(taxa.find((t) => t.tipo === 'Extrato bancário')).toMatchObject({ total: 1, acertos_tipo: 1 });
    expect(taxa.find((t) => t.tipo === 'Guias e comprovantes')).toMatchObject({ total: 1, acertos_tipo: 0 });
  });
});
