import { describe, expect, it } from 'vitest';
import { normalizarPrefs, PREFS_PADRAO, ehRotaPublica, TEMA_PADRAO } from '@/lib/backgroundPrefs';
import { IDS_PALETA } from '@/lib/paletas';

describe('estética', () => {
  it('tem 6 paletas, Dourada como padrão, escuro e Manchas como padrão', () => {
    expect(IDS_PALETA).toHaveLength(6);
    expect(PREFS_PADRAO.destaque).toBe('dourado');
    expect(PREFS_PADRAO.mode).toBe('manchas');
    expect(TEMA_PADRAO).toBe('escuro');
  });
  it('normaliza entradas inválidas para o padrão (lista fechada)', () => {
    const p = normalizarPrefs({ destaque: '<script>', mode: 'imagem', speed: 99, goldIntensity: -1, tema: 'roxo' });
    expect(p.destaque).toBe('dourado');
    expect(p.mode).toBe('manchas');
    expect(p.speed).toBe(3);
    expect(p.goldIntensity).toBe(0);
    expect(p.tema).toBeUndefined();
  });
  it('portal do cliente, /entrar e links de e-mail são rotas públicas (sempre Dourado)', () => {
    for (const r of ['/cliente', '/cliente/enviar', '/entrar', '/e/abc', '/instalar']) expect(ehRotaPublica(r)).toBe(true);
    for (const r of ['/inicio', '/clientes/x', '/ajustes/estetica']) expect(ehRotaPublica(r)).toBe(false);
  });
});
