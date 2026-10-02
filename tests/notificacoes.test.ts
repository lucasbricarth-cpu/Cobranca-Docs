import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos } from '@/lib/db';
import { avisarClientes, lembretesDoDia, avisarConferir, resumoDiario } from '@/lib/notificacoes/avisos';
import { emailsEnviadosNoLog, limparLogDeEmails } from '@/lib/notificacoes/email';
import { pushesNoLog, limparPushesNoLog } from '@/lib/notificacoes/push';
import { consumirLinkMagico, linkJaUsadoDoMesmoLogin } from '@/lib/auth/magico';
import { itemParaCliente } from '@/lib/consultas/cliente';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { rodarFila } from '@/lib/fila';
import { pdfDemo } from '@/lib/dev/demo-arquivos';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
let itau: string;
beforeAll(async () => {
  ids = await bancoLimpo();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
  itau = (await um<{ id: string }>(`SELECT s.id FROM subtipos s JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE c.final = '0567'`))!.id;
  // Carlos ativou o push num aparelho; Dona Silva não (recebe só pelo e-mail).
  await q(`INSERT INTO push_assinaturas (login_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.example/carlos', 'k', 'a')`, [ids.login]);
  await q(`INSERT INTO push_assinaturas (usuario_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.example/ana', 'k', 'a')`, [ids.admin]);
});
afterAll(fecharPool);
beforeEach(() => { limparLogDeEmails(); limparPushesNoLog(); });

const item = async (empresa: string, prazo: string, comp = '2026-09-01', tipoNome = 'Extrato bancário', sub: string | null = itau) =>
  (await um<{ id: string }>(`INSERT INTO itens_pedido (empresa_id, tipo_id, subtipo_id, competencia, prazo) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [empresa, tipo[tipoNome], sub, comp, prazo]))!.id;

describe('avisos ao cliente', () => {
  it('pedido criado: push e e-mail, uma vez só por item, canal e etapa', async () => {
    const i = await item(ids.empresas[101], '2026-10-05');
    const r1 = await avisarClientes([i], 'criado');
    expect(r1).toEqual({ emails: 1, pushes: 1 });
    const r2 = await avisarClientes([i], 'criado');
    expect(r2).toEqual({ emails: 0, pushes: 0 });
    const registro = await todos<{ canal: string; etapa: string; status: string }>(`SELECT canal, etapa, status FROM avisos WHERE item_id = $1 AND canal IN ('email','push') ORDER BY canal`, [i]);
    expect(registro).toEqual([{ canal: 'email', etapa: 'criado', status: 'enviado' }, { canal: 'push', etapa: 'criado', status: 'enviado' }]);
    // O banco recusa um segundo aviso igual (prova da cobrança única).
    await expect(q(`INSERT INTO avisos (item_id, login_id, canal, etapa) VALUES ($1, $2, 'email', 'criado')`, [i, ids.login])).rejects.toThrow(/aviso_unico/);
  });

  it('o texto do push e do e-mail não traz o banco, o valor nem o tipo do documento', async () => {
    const i = await item(ids.empresas[101], '2026-10-06', '2026-08-01');
    await avisarClientes([i], 'criado');
    const textos = [...emailsEnviadosNoLog().map((e) => `${e.assunto}\n${e.corpo}`), ...pushesNoLog().map((p) => `${p.title}\n${p.body}`)];
    expect(textos.length).toBeGreaterThanOrEqual(2);
    for (const t of textos) {
      expect(t).not.toMatch(/Ita[uú]|Sicredi|0567|R\$|\d+,\d{2}|Extrato|extrato|Fatura|Nota/);
    }
    expect(pushesNoLog()[0].body).toBe('Você tem um novo pedido do escritório.');
  });

  it('quem não ativou o push recebe pelo e-mail', async () => {
    const i = await item(ids.empresas[102], '2026-10-05', '2026-09-01', 'Notas fiscais de entrada', null);
    const r = await avisarClientes([i], 'criado');
    expect(r).toEqual({ emails: 1, pushes: 0 });
    expect(emailsEnviadosNoLog()[0].para).toBe('silva@oficina.com.br');
    expect((await um<{ status: string }>(`SELECT status FROM avisos WHERE item_id = $1 AND canal = 'push'`, [i]))!.status).toBe('sem_destino');
  });

  it('lembretes: 3 dias antes, no dia e depois do atraso; param quando o item é recebido', async () => {
    await q(`DELETE FROM avisos`); await q(`DELETE FROM itens_pedido`);
    const agora = new Date('2026-10-02T12:00:00Z'); // 02/10 em São Paulo
    const tres = await item(ids.empresas[101], '2026-10-05', '2026-07-01');
    const hoje = await item(ids.empresas[103], '2026-10-02', '2026-07-01', 'Notas fiscais de saída', null);
    const atraso = await item(ids.empresas[101], '2026-09-28', '2026-06-01', 'Notas fiscais de entrada', null);
    const recebido = await item(ids.empresas[101], '2026-10-02', '2026-05-01', 'Guias e comprovantes', null);
    await q(`UPDATE itens_pedido SET status = 'recebido' WHERE id = $1`, [recebido]);
    await lembretesDoDia(agora);
    const etapas = await todos<{ item_id: string; etapa: string }>(`SELECT DISTINCT item_id, etapa FROM avisos`);
    expect(etapas).toEqual(expect.arrayContaining([{ item_id: tres, etapa: '3dias' }, { item_id: hoje, etapa: 'dia' }, { item_id: atraso, etapa: 'atraso' }]));
    expect(etapas.some((e) => e.item_id === recebido)).toBe(false);
    // Rodar de novo no mesmo dia não manda nada.
    limparLogDeEmails();
    await lembretesDoDia(agora);
    expect(emailsEnviadosNoLog()).toHaveLength(0);
  });
});

describe('link do e-mail', () => {
  it('abre direto o item, só para aquele login, e expira', async () => {
    const i = await item(ids.empresas[101], '2026-10-09', '2026-04-01');
    await avisarClientes([i], 'criado');
    const link = emailsEnviadosNoLog().find((e) => e.para === 'carlos@padaria.com.br')!.corpo.match(/\/e\/([\w-]+)/)![1];
    const r = await consumirLinkMagico(link);
    expect(r).toEqual({ tipo: 'cliente', id: ids.login, destino: `/cliente/item/${i}` });
    // Usado de novo: só segue para o mesmo login; outro login no aparelho não entra.
    expect(await linkJaUsadoDoMesmoLogin(link, { tipo: 'cliente', id: ids.login })).toBe(`/cliente/item/${i}`);
    expect(await linkJaUsadoDoMesmoLogin(link, { tipo: 'cliente', id: ids.login2 })).toBeNull();
    // O item não abre para um login de outra empresa, mesmo com o id.
    expect(await itemParaCliente([{ id: ids.empresas[102] }], i)).toBeNull();
    expect(await itemParaCliente([{ id: ids.empresas[101] }], i)).not.toBeNull();
    // Expirado não vale.
    await q(`UPDATE links_magicos SET expira_em = now() - interval '1 second'`);
    expect(await linkJaUsadoDoMesmoLogin(link, { tipo: 'cliente', id: ids.login })).toBeNull();
  });
});

describe('avisos ao escritório', () => {
  it('chegou arquivo para conferir: push ao responsável, uma vez por documento', async () => {
    const d = await registrarEnvio({ dados: await pdfDemo('Conferir', ['x']), nomeOriginal: 'c.pdf', origem: 'app', empresaId: ids.empresas[101], tipoId: tipo['Outros'], competencia: '2026-09-01' });
    while ((await rodarFila(20)) > 0) { /* processa (e já avisa) */ }
    const doAdmin = pushesNoLog().filter((p) => p.endpoint.includes('/ana'));
    expect(doAdmin).toHaveLength(1);
    expect(doAdmin[0].body).toBe('Chegou um arquivo para conferir em Padaria do Bairro Ltda.');
    expect(await avisarConferir(d.id)).toBe(0);
  });
  it('resumo diário por e-mail, uma vez por dia', async () => {
    const agora = new Date('2026-10-02T09:00:00Z');
    const r1 = await resumoDiario(agora);
    expect(r1.enviados).toBeGreaterThan(0);
    expect(emailsEnviadosNoLog().some((e) => e.para === 'ana@escritorio.com.br' && /para conferir/.test(e.assunto))).toBe(true);
    expect((await resumoDiario(agora)).enviados).toBe(0);
  });
});
