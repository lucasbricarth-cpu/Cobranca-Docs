import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { bancoLimpo, fecharPool } from './banco';
import { abrirConexao } from '../leitor-dominio/src/conexao.ts';
import { lerDominio } from '../leitor-dominio/src/ler.ts';
import { conferirConsulta, EscritaRecusada } from '../leitor-dominio/src/trava.ts';
import { sincronizarDominio } from '@/lib/dominio/sincronizar';
import { todos, um } from '@/lib/db';

const urlTeste = process.env.DATABASE_URL_TEST!;
const urlLeitor = (() => { const u = new URL(urlTeste); u.username = 'dominio_leitor'; u.password = 'leitor'; return u.toString(); })();

beforeAll(async () => {
  await bancoLimpo();
  const admin = new pg.Client({ connectionString: urlTeste });
  await admin.connect();
  await admin.query(readFileSync('leitor-dominio/sql/dominio-simulado.sql', 'utf8'));
  await admin.end();
});
afterAll(fecharPool);

describe('leitor da Domínio: só leitura', () => {
  it('a trava recusa qualquer coisa que não seja um SELECT nas tabelas da lista', () => {
    expect(() => conferirConsulta('SELECT codi_emp FROM geempre')).not.toThrow();
    expect(() => conferirConsulta('INSERT INTO geempre (codi_emp) VALUES (1)')).toThrow(EscritaRecusada);
    expect(() => conferirConsulta('UPDATE geempre SET nome_emp = 1')).toThrow(EscritaRecusada);
    expect(() => conferirConsulta('DELETE FROM geempre')).toThrow(EscritaRecusada);
    expect(() => conferirConsulta('SELECT 1 FROM geempre; DELETE FROM geempre')).toThrow(EscritaRecusada);
    expect(() => conferirConsulta('SELECT * INTO copia FROM geempre')).toThrow(EscritaRecusada);
    expect(() => conferirConsulta('SELECT salario FROM fofolha')).toThrow(/fora da lista/);
  });

  it('com o usuário só de leitura, uma tentativa de escrita falha no próprio banco', async () => {
    // Por fora da trava, direto no banco, com o usuário do leitor:
    const c = new pg.Client({ connectionString: urlLeitor });
    await c.connect();
    await expect(c.query(`INSERT INTO geempre (codi_emp, nome_emp) VALUES (999, 'x')`)).rejects.toThrow(/permission denied|permissão negada/);
    await expect(c.query(`UPDATE geempre SET nome_emp = 'x'`)).rejects.toThrow(/permission denied|permissão negada/);
    await expect(c.query(`DELETE FROM geempre`)).rejects.toThrow(/permission denied|permissão negada/);
    await expect(c.query(`SELECT salario FROM fofolha`)).rejects.toThrow(/permission denied|permissão negada/);
    await c.end();
    // E pela conexão do leitor, a trava recusa antes de chegar ao banco:
    const leitor = await abrirConexao({ DOMINIO_DRIVER: 'pg', DOMINIO_PG: urlLeitor } as unknown as NodeJS.ProcessEnv);
    await expect(leitor.consultar(`DELETE FROM geempre`)).rejects.toThrow(EscritaRecusada);
    await leitor.fechar();
  });

  it('lê as empresas, contatos, responsáveis e contas e sincroniza no app', async () => {
    const leitor = await abrirConexao({ DOMINIO_DRIVER: 'pg', DOMINIO_PG: urlLeitor } as unknown as NodeJS.ProcessEnv);
    const lote = await lerDominio(leitor, {
      diagnostico: true,
      sqlEncerradas: `SELECT c.codi_emp, c.i_conta_caixa FROM ctcontacaixa_conta_bancaria c JOIN ctcontas t ON t.codi_emp = c.codi_emp AND t.codi_cta = c.i_conta_caixa WHERE t.situacao_cta = 'I'`,
    });
    await leitor.fechar();
    expect(lote.empresas).toHaveLength(3);
    expect(lote.empresas[0].cnpj).toMatch(/^\d{14}$/);
    expect(lote.diagnostico?.moduloWeb).toEqual({ n: '1' });

    const resumo = await sincronizarDominio(JSON.parse(JSON.stringify(lote)));
    expect(resumo.empresas).toBe(3);
    const novo = await um<{ nome: string; responsavel_id: string | null; telefone_e164: string | null }>(`SELECT nome, responsavel_id, telefone_e164 FROM empresas WHERE codi_emp = 104`);
    expect(novo?.nome).toBe('Mercadinho Novo');
    expect(novo?.responsavel_id).not.toBeNull();
    const contas = await todos<{ final: string; codigo_banco: string; situacao: string; pedir: boolean }>(
      `SELECT c.final, c.codigo_banco, c.situacao, c.pedir FROM contas_bancarias c JOIN empresas e ON e.id = c.empresa_id WHERE e.codi_emp = 101 ORDER BY c.i_conta_caixa`);
    expect(contas.map((c) => c.final)).toEqual(['5670', '0921']);
    // Conta encerrada na Domínio só vira sugestão: o app nunca para de pedir sozinho.
    expect(contas[1].situacao).toBe('encerrada');
    expect(contas[1].pedir).toBe(true);
    const folha = await um(`SELECT 1 FROM responsaveis_empresa r JOIN empresas e ON e.id = r.empresa_id WHERE e.codi_emp = 101 AND r.papel = 'folha'`);
    expect(folha).toBeTruthy();
  });
});
