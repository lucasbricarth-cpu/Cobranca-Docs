import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos } from '@/lib/db';
import { rodarFila } from '@/lib/fila';
import { receberWebhook } from '@/lib/whatsapp/fluxo';
import { assinarSimulado } from '@/lib/whatsapp/simulado';
import { confirmarNumero, registrarAceite } from '@/lib/whatsapp/numeros';
import { avisarClientes } from '@/lib/notificacoes/avisos';
import { desativarLogin } from '@/lib/logins';
import { chamadasIA } from '@/lib/classificacao/ia';
import { pdfDemo, fotoDemo } from '@/lib/dev/demo-arquivos';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
let itau: string;
const CARLOS = '5511988887777';  // Padaria + Consultório
const SILVA = '5511933334444';   // só a Oficina
const DESCONHECIDO = '5521900000000';
let seq = 0;

beforeAll(async () => {
  ids = await bancoLimpo();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
  itau = (await um<{ id: string }>(`SELECT s.id FROM subtipos s JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE c.final = '0567'`))!.id;
  await confirmarNumero(ids.login, '(11) 98888-7777', ids.admin);
  await confirmarNumero(ids.login2, '11 93333-4444', ids.admin);
});
afterAll(fecharPool);

async function webhook(msgs: Record<string, unknown>[], assinatura?: string) {
  const corpo = JSON.stringify({ mensagens: msgs });
  return receberWebhook(corpo, new Headers({ 'x-assinatura': assinatura ?? assinarSimulado(corpo) }));
}
const arquivo = async (de: string, dados: Buffer, nome = 'doc.pdf', mime = 'application/pdf', id?: string) =>
  ({ id: id ?? `m${++seq}`, de, tipo: 'arquivo', arquivo: { base64: dados.toString('base64'), mime, nome } });
const processar = async () => { for (let i = 0; i < 50; i++) if ((await rodarFila(50)) === 0) break; };
const enviadas = (numero: string) => todos<{ tipo: string; conteudo: Record<string, unknown> }>(`SELECT tipo, conteudo FROM whatsapp_enviadas WHERE numero = $1 ORDER BY id`, [numero]);
const limpar = () => q(`DELETE FROM whatsapp_enviadas`);

describe('webhook', () => {
  it('assinatura inválida é recusada', async () => {
    expect(await webhook([await arquivo(CARLOS, Buffer.from('x'))], 'errada')).toBeNull();
  });
  it('o mesmo aviso repetido não vira dois documentos', async () => {
    const m = await arquivo(SILVA, await pdfDemo('Repetido', ['x']), 'rep.pdf', 'application/pdf', 'wamid.REPETIDO');
    expect(await webhook([m])).toEqual({ novos: 1, repetidos: 0 });
    expect(await webhook([m])).toEqual({ novos: 0, repetidos: 1 });
    await processar();
    const n = await um<{ n: number }>(`SELECT count(*)::int AS n FROM documentos WHERE nome_original = 'rep.pdf'`);
    expect(n?.n).toBe(1);
  });
});

describe('número sem vínculo confirmado', () => {
  it('só recebe a mensagem genérica, e o arquivo vai para a pasta geral', async () => {
    await limpar();
    await webhook([await arquivo(DESCONHECIDO, await pdfDemo('Boleto', ['CNPJ 11.222.333/0001-81']), 'boleto.pdf')]);
    await processar();
    const d = await um<{ empresa_id: string | null; status: string; whatsapp_numero: string }>(`SELECT empresa_id, status, whatsapp_numero FROM documentos WHERE nome_original = 'boleto.pdf'`);
    expect(d).toEqual({ empresa_id: null, status: 'nao_reconhecido', whatsapp_numero: DESCONHECIDO });
    const env = await enviadas(DESCONHECIDO);
    const textos = env.filter((e) => e.tipo === 'texto');
    expect(textos).toHaveLength(1);
    expect(textos[0].conteudo.texto).toBe('Recebemos o seu arquivo, obrigado! A nossa equipe vai conferir e, se precisar de algo, entra em contato.');
    expect(JSON.stringify(env)).not.toMatch(/Padaria|Boleto|Extrato/);
  });
});

describe('número com várias empresas', () => {
  it('é obrigado a escolher (nada marcado); escolha fora da lista é ignorada', async () => {
    await limpar();
    await webhook([await arquivo(CARLOS, await pdfDemo('Recibo', ['sem identificação']), 'recibo.pdf')]);
    await processar();
    const [pergunta] = (await enviadas(CARLOS)).filter((e) => e.tipo === 'botoes');
    expect(pergunta.conteudo.texto).toBe('Esse documento é de qual empresa?');
    const ops = (pergunta.conteudo.botoes as { id: string }[]).map((b) => b.id);
    expect(ops).toEqual([`emp:${ids.empresas[103]}`, `emp:${ids.empresas[101]}`]);
    // Tentar a empresa de outro cliente (a Oficina) não faz nada.
    await webhook([{ id: `m${++seq}`, de: CARLOS, tipo: 'botao', botao: `emp:${ids.empresas[102]}` }]);
    await processar();
    expect((await um<{ empresa_id: string | null }>(`SELECT empresa_id FROM documentos WHERE nome_original = 'recibo.pdf'`))!.empresa_id).toBeNull();
  });

  it('com o CNPJ da empresa no arquivo: "Parece ser da Empresa A. Confirma?"; depois mês, resultado e nota interna', async () => {
    await q(`DELETE FROM whatsapp_conversas`); await limpar();
    await q(`INSERT INTO itens_pedido (empresa_id, tipo_id, subtipo_id, competencia, prazo) VALUES ($1, $2, $3, '2026-08-01', '2026-09-05'), ($1, $2, $3, '2026-09-01', '2026-10-05')`, [ids.empresas[101], tipo['Extrato bancário'], itau]);
    // Dois arquivos seguidos: uma resposta só.
    await webhook([
      await arquivo(CARLOS, await pdfDemo('Itaú · Extrato', ['Agência 0912  Conta 1056-7', 'PADARIA  CNPJ 11.222.333/0001-81']), 'extrato.pdf'),
      await arquivo(CARLOS, await pdfDemo('Anotação', ['rascunho']), 'anotacao.pdf'),
    ]);
    await processar();
    let env = await enviadas(CARLOS);
    expect(env.filter((e) => e.tipo === 'botoes')).toHaveLength(1);
    expect(env[0].conteudo.texto).toBe('Parece ser da Padaria do Bairro Ltda. Confirma?');
    await webhook([{ id: `m${++seq}`, de: CARLOS, tipo: 'botao', botao: 'emp_sim' }]);
    await processar();
    // Dois meses abertos para o extrato do Itaú: pergunta qual, com os meses pendentes.
    env = await enviadas(CARLOS);
    const mes = env.filter((e) => e.tipo === 'botoes').at(-1)!;
    expect(mes.conteudo.texto).toBe('É de qual mês?');
    expect((mes.conteudo.botoes as { titulo: string }[]).map((b) => b.titulo)).toEqual(['Agosto 2026', 'Setembro 2026']);
    const escolha = (mes.conteudo.botoes as { id: string }[])[1].id;
    await webhook([{ id: `m${++seq}`, de: CARLOS, tipo: 'botao', botao: escolha }]);
    await processar();
    env = await enviadas(CARLOS);
    const resultado = env.filter((e) => e.tipo === 'botoes').at(-1)!;
    expect(resultado.conteudo.texto).toBe('Recebemos: Extrato Itaú (final 0567), setembro/2026. Está certo?\n1 arquivo(s) a nossa equipe vai conferir.');
    await webhook([{ id: `m${++seq}`, de: CARLOS, tipo: 'botao', botao: 'ok' }]);
    await processar();
    const nota = (await enviadas(CARLOS)).filter((e) => e.tipo === 'nota').at(-1)!;
    expect(nota.conteudo.texto).toMatch(/Arquivado em Extrato bancário › Itaú final 0567 › Setembro 2026/);
    expect(nota.conteudo.texto).toMatch(/Foi para Não reconhecidos/);
    const item = await um<{ status: string }>(`SELECT status FROM itens_pedido WHERE empresa_id = $1 AND competencia = '2026-09-01' AND subtipo_id = $2`, [ids.empresas[101], itau]);
    expect(item?.status).toBe('recebido');
  });

  it('sem resposta em algumas horas, o arquivo vai para Não reconhecidos', async () => {
    await q(`DELETE FROM whatsapp_conversas`); await limpar();
    await webhook([await arquivo(CARLOS, await pdfDemo('Guia', ['CNPJ 07.526.557/0001-00', 'comprovante']), 'guia.pdf')]);
    await processar();
    expect((await enviadas(CARLOS)).some((e) => e.tipo === 'botoes')).toBe(true);
    // passam as horas
    await q(`UPDATE fila SET executar_em = now() WHERE tipo = 'whatsapp_expirar' AND status = 'pendente'`);
    await processar();
    expect((await um<{ status: string }>(`SELECT status FROM documentos WHERE nome_original = 'guia.pdf'`))!.status).toBe('nao_reconhecido');
    expect(await um(`SELECT 1 FROM whatsapp_conversas WHERE numero = $1`, [CARLOS])).toBeNull();
  });
});

describe('pedidos pelo WhatsApp', () => {
  it('contato sem aceite não recebe mensagem automática; com aceite, recebe o modelo com o botão do pedido', async () => {
    await limpar();
    const i1 = (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, competencia, prazo) VALUES ($1, $2, '2026-09-01', '2026-10-10') RETURNING id`, [ids.empresas[102], tipo['Notas fiscais de entrada']]))!.id;
    await avisarClientes([i1], 'criado');
    expect((await enviadas(SILVA)).filter((e) => e.tipo === 'modelo')).toHaveLength(0);
    expect((await um<{ status: string }>(`SELECT status FROM avisos WHERE item_id = $1 AND canal = 'whatsapp'`, [i1]))!.status).toBe('sem_aceite');
    await registrarAceite(ids.login2, 'presencial', null, ids.admin);
    const i2 = (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, competencia, prazo) VALUES ($1, $2, '2026-09-01', '2026-10-10') RETURNING id`, [ids.empresas[102], tipo['Notas fiscais de saída']]))!.id;
    await avisarClientes([i2], 'criado');
    const [modelo] = (await enviadas(SILVA)).filter((e) => e.tipo === 'modelo');
    expect(modelo.conteudo.nome).toBe('pedido_documento');
    expect(String(modelo.conteudo.textoRenderizado)).toMatch(/^Olá, Dona\./);
    expect(String(modelo.conteudo.textoRenderizado)).not.toMatch(/Nota|nota fiscal|R\$/);
    expect(modelo.conteudo.botaoUrlSufixo).toEqual(expect.any(String));
    // Régua curta: 3 dias antes e atraso não vão pelo WhatsApp.
    await limpar();
    await avisarClientes([i2], '3dias');
    expect((await enviadas(SILVA)).filter((e) => e.tipo === 'modelo')).toHaveLength(0);
  });

  it('tipo sensível não aparece na confirmação (nem passa pela IA)', async () => {
    await registrarAceite(ids.login, 'whatsapp', null, ids.admin);
    await q(`DELETE FROM whatsapp_conversas`); await limpar();
    // Pedido sensível de uma empresa só do Carlos? Ele tem duas: o arquivo vai junto do pedido sensível.
    const it = (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, competencia, prazo) VALUES ($1, $2, '2026-09-01', '2026-10-10') RETURNING id`, [ids.empresas[101], tipo['Atestados e exames de funcionário']]))!.id;
    await avisarClientes([it], 'criado');
    const antes = chamadasIA.total;
    await webhook([await arquivo(CARLOS, await fotoDemo('Atestado médico'), 'IMG-001.jpg', 'image/jpeg')]);
    await processar();
    expect(chamadasIA.total).toBe(antes);
    const textos = (await enviadas(CARLOS)).filter((e) => e.tipo === 'texto' || e.tipo === 'botoes');
    expect(textos.at(-1)!.conteudo.texto).toBe('Recebemos o seu documento. Obrigado!');
    expect(JSON.stringify(textos)).not.toMatch(/Atestado|exame|funcionário/i);
  });

  it('desativar o login desliga o número na mesma hora', async () => {
    await desativarLogin(ids.login2);
    await limpar();
    await webhook([await arquivo(SILVA, await pdfDemo('Depois', ['x']), 'depois.pdf')]);
    await processar();
    expect((await um<{ empresa_id: string | null }>(`SELECT empresa_id FROM documentos WHERE nome_original = 'depois.pdf'`))!.empresa_id).toBeNull();
    expect((await enviadas(SILVA)).filter((e) => e.tipo === 'texto')[0].conteudo.texto).toMatch(/^Recebemos o seu arquivo/);
  });
});
