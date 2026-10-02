import { describe, expect, it } from 'vitest';
import { competenciaDoMes, competenciaPelaRegra, somarMeses, reconhecerMes, nomeDoMes, mesCurto } from '@/lib/tempo';

describe('tempo em America/Sao_Paulo', () => {
  it('22h do último dia do mês em SP continua no mês (mesmo já sendo o dia 1º em UTC)', () => {
    const instante = new Date('2026-10-01T01:00:00Z'); // 30/09/2026 22:00 em SP
    expect(competenciaDoMes(instante)).toBe('2026-09-01');
    expect(competenciaPelaRegra('anterior', instante)).toBe('2026-08-01');
    expect(competenciaPelaRegra('atual', instante)).toBe('2026-09-01');
  });
  it('soma meses atravessando o ano', () => {
    expect(somarMeses('2026-01-01', -1)).toBe('2025-12-01');
    expect(somarMeses('2026-12-01', 1)).toBe('2027-01-01');
  });
  it('reconhece meses digitados na busca', () => {
    expect(reconhecerMes('setembro', 2026)).toBe('2026-09-01');
    expect(reconhecerMes('set/2025', 2026)).toBe('2025-09-01');
    expect(reconhecerMes('09/2026', 2026)).toBe('2026-09-01');
    expect(reconhecerMes('marco', 2026)).toBe('2026-03-01');
    expect(reconhecerMes('itau', 2026)).toBeNull();
  });
  it('formata nomes de mês', () => {
    expect(nomeDoMes('2026-09-01')).toBe('Setembro 2026');
    expect(mesCurto('2026-09-01')).toBe('Set/2026');
  });
});
