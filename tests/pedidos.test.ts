import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { q, um, todos } from '@/lib/db';
import { criarPedido } from '@/lib/pedidos';
import { rodarAgenda, datasDoModelo } from '@/lib/agenda';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
let tipo: Record<string, string>;
beforeAll(async () => {
  ids = await bancoLimpo();
  tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
});
afterAll(fecharPool);

const itensDe = (empresa: string, comp: string, tipoNome: string) =>
  todos<{ subtipo_id: string | null; status: string }>(`SELECT subtipo_id, status FROM itens_pedido WHERE empresa_id = $1 AND competencia = $2 AND tipo_id = $3`, [empresa, comp, tipo[tipoNome]]);

describe('pedido avulso e a restrição única', () => {
  it('o banco recusa um segundo item com a mesma empresa, tipo, subtipo e competência', async () => {
    await q(`INSERT INTO itens_pedido (empresa_id, tipo_id, competencia) VALUES ($1, $2, '2026-01-01')`, [ids.empresas[101], tipo['Notas fiscais de entrada']]);
    await expect(q(`INSERT INTO itens_pedido (empresa_id, tipo_id, competencia) VALUES ($1, $2, '2026-01-01')`, [ids.empresas[101], tipo['Notas fiscais de entrada']]))
      .rejects.toThrow(/um_item_por_competencia/);
  });

  it('"Todas as contas da empresa" pede uma por conta ativa; pedir de novo não duplica', async () => {
    const r1 = await criarPedido({ empresaIds: [ids.empresas[101]], tipoId: tipo['Extrato bancário'], subtipos: 'todos', competencia: '2026-02-01', prazo: '2026-03-05', origem: 'avulso' });
    expect(r1.itensCriados).toHaveLength(2); // Itaú e Sicredi
    const r2 = await criarPedido({ empresaIds: [ids.empresas[101]], tipoId: tipo['Extrato bancário'], subtipos: 'todos', competencia: '2026-02-01', prazo: '2026-03-05', origem: 'avulso' });
    expect(r2.itensCriados).toHaveLength(0);
    expect(r2.jaExistiam).toBe(2);
    expect(await itensDe(ids.empresas[101], '2026-02-01', 'Extrato bancário')).toHaveLength(2);
  });

  it('conta que o funcionário parou de pedir fica de fora', async () => {
    await q(`UPDATE subtipos SET ativo = false WHERE id = (SELECT s.id FROM subtipos s JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE c.final = '0921')`);
    const r = await criarPedido({ empresaIds: [ids.empresas[101]], tipoId: tipo['Extrato bancário'], subtipos: 'todos', competencia: '2026-03-01', prazo: null, origem: 'avulso' });
    expect(r.itensCriados).toHaveLength(1);
    await q(`UPDATE subtipos SET ativo = true`);
  });

  it('várias empresas de uma vez; empresa sem conta é avisada, não quebra', async () => {
    const r = await criarPedido({ empresaIds: [ids.empresas[101], ids.empresas[102], ids.empresas[103]], tipoId: tipo['Fatura de cartão'], subtipos: 'todos', competencia: '2026-04-01', prazo: null, origem: 'avulso' });
    expect(r.itensCriados).toHaveLength(0);
    expect(r.empresasSemSubtipo).toHaveLength(3);
    const n = await criarPedido({ empresaIds: [ids.empresas[101], ids.empresas[102]], tipoId: tipo['Notas fiscais de saída'], subtipos: 'todos', competencia: '2026-04-01', prazo: null, origem: 'avulso' });
    expect(n.itensCriados).toHaveLength(2);
  });

  it('subtipos específicos não valem para várias empresas', async () => {
    await expect(criarPedido({ empresaIds: [ids.empresas[101], ids.empresas[102]], tipoId: tipo['Extrato bancário'], subtipos: ['00000000-0000-0000-0000-000000000000'], competencia: '2026-04-01', prazo: null, origem: 'avulso' }))
      .rejects.toThrow(/várias/);
  });
});

describe('agenda no fuso de São Paulo', () => {
  it('datas do modelo: prazo no mês seguinte quando o dia é menor; dia 31 vira o último do mês', () => {
    expect(datasDoModelo({ dia_criacao: 1, dia_prazo: 5, meses_competencia: -1 }, '2026-10-01')).toEqual({ competencia: '2026-09-01', prazo: '2026-10-05' });
    expect(datasDoModelo({ dia_criacao: 25, dia_prazo: 5, meses_competencia: 0 }, '2026-12-25')).toEqual({ competencia: '2026-12-01', prazo: '2027-01-05' });
    expect(datasDoModelo({ dia_criacao: 1, dia_prazo: 31, meses_competencia: -1 }, '2027-02-01')).toEqual({ competencia: '2027-01-01', prazo: '2027-02-28' });
  });

  it('às 23h do dia 30 em São Paulo (já dia 1º em UTC) ainda não roda os modelos do dia 1º', async () => {
    const r = await rodarAgenda(new Date('2026-10-01T02:00:00Z'));
    expect(r.dia).toBe('2026-09-30');
    expect(r.itens).toBe(0);
  });

  it('no dia 1º cria os pedidos do perfil; rodar de novo no mesmo dia não duplica', async () => {
    const dia1 = new Date('2026-10-01T09:00:00Z'); // 06:00 em SP
    const r1 = await rodarAgenda(dia1);
    expect(r1.dia).toBe('2026-10-01');
    expect(r1.itens).toBeGreaterThan(0);
    // Padaria (simples): 2 extratos + notas de entrada + notas de saída (sem cartão cadastrado).
    expect(await itensDe(ids.empresas[101], '2026-09-01', 'Extrato bancário')).toHaveLength(2);
    expect(await itensDe(ids.empresas[101], '2026-09-01', 'Notas fiscais de entrada')).toHaveLength(1);
    // Consultório (presumido) recebe as Guias; a Padaria (simples), não.
    expect(await itensDe(ids.empresas[103], '2026-09-01', 'Guias e comprovantes')).toHaveLength(1);
    expect(await itensDe(ids.empresas[101], '2026-09-01', 'Guias e comprovantes')).toHaveLength(0);
    const prazo = await um<{ prazo: string }>(`SELECT to_char(prazo, 'YYYY-MM-DD') AS prazo FROM itens_pedido WHERE empresa_id = $1 AND competencia = '2026-09-01' AND tipo_id = $2 LIMIT 1`, [ids.empresas[101], tipo['Extrato bancário']]);
    expect(prazo?.prazo).toBe('2026-10-05');
    const r2 = await rodarAgenda(dia1);
    expect(r2.itens).toBe(0);
    expect(r2.jaExistiam).toBe(r1.itens);
  });

  it('o modelo "com folha" só vale para empresas com folha, e o ajuste por empresa desliga', async () => {
    const folha = (await um<{ id: string }>(`SELECT id FROM modelos_agenda WHERE perfil = 'folha'`))!.id;
    await q(`INSERT INTO agenda_empresa (empresa_id, modelo_id, ativo) VALUES ($1, $2, false)`, [ids.empresas[103], folha]);
    await rodarAgenda(new Date('2026-10-20T12:00:00Z'));
    expect(await itensDe(ids.empresas[101], '2026-10-01', 'Folha: ponto e eventos')).toHaveLength(1); // Padaria tem folha
    expect(await itensDe(ids.empresas[102], '2026-10-01', 'Folha: ponto e eventos')).toHaveLength(0); // Oficina não tem
    expect(await itensDe(ids.empresas[103], '2026-10-01', 'Folha: ponto e eventos')).toHaveLength(0); // desligado só para ela
  });
});
