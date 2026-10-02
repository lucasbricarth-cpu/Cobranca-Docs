import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoLimpo, fecharPool } from './banco';
import { criarSessao, sessaoPorToken, autorizarEmpresa, NaoAutorizado, type Cliente } from '@/lib/auth/sessao';
import { desativarLogin } from '@/lib/logins';
import { um } from '@/lib/db';

let ids: Awaited<ReturnType<typeof bancoLimpo>>;
beforeAll(async () => { ids = await bancoLimpo(); });
afterAll(fecharPool);

describe('isolamento entre empresas (logins)', () => {
  it('a sessão do cliente só carrega as empresas dos vínculos', async () => {
    const token = await criarSessao('cliente', ids.login2);
    const s = (await sessaoPorToken(token)) as Cliente;
    expect(s.tipo).toBe('cliente');
    expect(s.empresas.map((e) => e.id)).toEqual([ids.empresas[102]]);
  });
  it('um login da empresa A não passa pela autorização da empresa B, mesmo trocando o id', async () => {
    const token = await criarSessao('cliente', ids.login2);
    const s = (await sessaoPorToken(token))!;
    expect(() => autorizarEmpresa(s, ids.empresas[102])).not.toThrow();
    expect(() => autorizarEmpresa(s, ids.empresas[101])).toThrow(NaoAutorizado);
    expect(() => autorizarEmpresa(s, '00000000-0000-0000-0000-000000000000')).toThrow(NaoAutorizado);
  });
  it('desativar o login derruba as sessões na hora e não apaga nada', async () => {
    const token = await criarSessao('cliente', ids.login2);
    await desativarLogin(ids.login2);
    expect(await sessaoPorToken(token)).toBeNull();
    expect(await um(`SELECT 1 FROM logins_cliente WHERE id = $1`, [ids.login2])).toBeTruthy();
  });
});
