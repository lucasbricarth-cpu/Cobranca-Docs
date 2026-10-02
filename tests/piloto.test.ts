import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos } from '@/lib/db';
import { rodarAgenda } from '@/lib/agenda';
import { avisarClientes } from '@/lib/notificacoes/avisos';
import { emailsEnviadosNoLog, limparLogDeEmails } from '@/lib/notificacoes/email';
import { marcarPiloto, modoPiloto, metricas, volumeWhatsApp } from '@/lib/piloto';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { rejeitarDocumento } from '@/lib/documentos/acoes';
import { rodarFila } from '@/lib/fila';
import { pdfDemo } from '@/lib/dev/demo-arquivos';
import type { Funcionario } from '@/lib/auth/sessao';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
beforeAll(async () => {
  ids = await bancoLimpo();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
});
afterAll(fecharPool);
async function processar() { while ((await rodarFila(50)) > 0) { /* até esvaziar */ } }
const item = async (empresa: string, tipoNome: string, comp: string, prazo: string, criado: string) => (await um<{ id: string }>(
  `INSERT INTO itens_pedido (empresa_id, tipo_id, competencia, prazo, criado_em) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [empresa, tipo[tipoNome], comp, prazo, criado]))!.id;

describe('modo piloto', () => {
  it('sem empresa marcada vale a carteira inteira; com empresas marcadas, agenda e avisos só para elas', async () => {
    expect(await modoPiloto()).toBe(false);
    await marcarPiloto(ids.empresas[102], true);
    expect(await modoPiloto()).toBe(true);
    const r = await rodarAgenda(new Date('2026-10-01T09:00:00Z'));
    const empresas = await todos<{ empresa_id: string }>(`SELECT DISTINCT empresa_id FROM itens_pedido`);
    expect(r.itens).toBeGreaterThan(0);
    expect(empresas.map((e) => e.empresa_id)).toEqual([ids.empresas[102]]);

    limparLogDeEmails();
    const fora = await item(ids.empresas[101], 'Notas fiscais de saída', '2026-08-01', '2026-09-10', '2026-09-01T12:00:00Z');
    expect(await avisarClientes([fora], 'criado')).toMatchObject({ emails: 0, pushes: 0 });
    const dentro = (await um<{ id: string }>(`SELECT id FROM itens_pedido WHERE empresa_id = $1 LIMIT 1`, [ids.empresas[102]]))!.id;
    expect((await avisarClientes([dentro], 'criado')).emails).toBe(1);
    expect(emailsEnviadosNoLog().map((e) => e.para)).toEqual(['silva@oficina.com.br']);

    await marcarPiloto(ids.empresas[102], false);
    expect((await avisarClientes([fora], 'criado')).emails).toBe(1); // carteira inteira de novo
  });
});

describe('métricas do piloto', () => {
  it('tempo até o envio (até o primeiro arquivo), no prazo, rejeitados e WhatsApp, por tipo', async () => {
    await q(`DELETE FROM avisos`); await q(`DELETE FROM itens_pedido`);
    await marcarPiloto(ids.empresas[101], true);
    const ana: Funcionario = { tipo: 'funcionario', id: ids.admin, nome: 'Ana Lima', email: 'ana@escritorio.com.br', papel: 'admin' };
    const t = 'Notas fiscais de entrada';
    // Item 1: pedido em 01/09 09h (SP), enviado 10 h depois, no prazo; depois rejeitado e reenviado.
    const i1 = await item(ids.empresas[101], t, '2026-08-01', '2026-09-05', '2026-09-01T12:00:00Z');
    const d1 = await registrarEnvio({ dados: await pdfDemo('NF 1', ['a']), nomeOriginal: 'nf1.pdf', origem: 'app', empresaId: ids.empresas[101], tipoId: tipo[t], competencia: '2026-08-01', itemId: i1 });
    await processar();
    await q(`UPDATE documentos SET recebido_em = '2026-09-01T22:00:00Z' WHERE id = $1`, [d1.id]);
    await rejeitarDocumento(d1.id, 'Faltam páginas.', ana);
    const d1b = await registrarEnvio({ dados: await pdfDemo('NF 1b', ['b']), nomeOriginal: 'nf1b.pdf', origem: 'whatsapp', empresaId: ids.empresas[101], tipoId: tipo[t], competencia: '2026-08-01', itemId: i1 });
    await processar();
    await q(`UPDATE documentos SET recebido_em = '2026-09-08T12:00:00Z' WHERE id = $1`, [d1b.id]);
    // Item 2: enviado pelo WhatsApp 30 h depois, às 22h30 do dia do prazo em São Paulo (01h30 do dia seguinte em UTC): ainda no prazo.
    const i2 = await item(ids.empresas[101], t, '2026-09-01', '2026-10-05', '2026-10-04T19:30:00Z');
    const d2 = await registrarEnvio({ dados: await pdfDemo('NF 2', ['c']), nomeOriginal: 'nf2.pdf', origem: 'whatsapp', empresaId: ids.empresas[101], tipoId: tipo[t], competencia: '2026-09-01', itemId: i2 });
    await processar();
    await q(`UPDATE documentos SET recebido_em = '2026-10-06T01:30:00Z' WHERE id = $1`, [d2.id]);
    // Item 3: ainda não enviado e vencido. Item 4: de fora do piloto (não conta).
    await item(ids.empresas[101], t, '2026-07-01', '2026-09-03', '2026-09-01T12:00:00Z');
    await item(ids.empresas[103], t, '2026-08-01', '2026-09-05', '2026-09-01T12:00:00Z');

    const [m] = (await metricas({ desde: '2026-09-01', ate: '2026-10-31', soPiloto: true })).filter((x) => x.tipo === t);
    expect(m).toMatchObject({ itens: 3, enviados: 2, no_prazo: 2, atrasados_abertos: 1, rejeitados: 1, pelo_whatsapp: 1 });
    expect(m.mediana_h).toBe(20); // 10 h e 30 h
    const [todas] = (await metricas({ desde: '2026-09-01', ate: '2026-10-31', soPiloto: false })).filter((x) => x.tipo === t);
    expect(todas.itens).toBe(4);
    // Período no fuso de São Paulo: o item criado às 21h de 31/08 (00h de 01/09 em UTC) fica fora de setembro.
    await item(ids.empresas[101], 'Notas fiscais de saída', '2026-08-01', '2026-09-05', '2026-09-01T00:00:00Z');
    const [saida] = (await metricas({ desde: '2026-09-01', ate: '2026-09-30', soPiloto: true })).filter((x) => x.tipo === 'Notas fiscais de saída');
    expect(saida.itens).toBe(0);
  });

  it('volume do WhatsApp por dia, com os dias sem envio', async () => {
    const v = await volumeWhatsApp(14);
    expect(v).toHaveLength(14);
    expect(v.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.dia))).toBe(true);
  });
});
