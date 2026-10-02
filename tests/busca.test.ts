import { describe, expect, it } from 'vitest';
import { interpretarBusca } from '@/lib/documentos/busca';

const ctx = {
  competenciaAtual: '2026-10-01',
  tipos: [{ id: 't-ext', nome: 'Extrato bancário' }, { id: 't-fat', nome: 'Fatura de cartão' }, { id: 't-nfe', nome: 'Notas fiscais de entrada' }, { id: 't-nfs', nome: 'Notas fiscais de saída' }],
  subtipos: [
    { id: 's-itau', rotulo: 'Itaú final 0567', codigo_banco: '341', conta_final: '0567' },
    { id: 's-sic', rotulo: 'Sicredi final 0921', codigo_banco: '748', conta_final: '0921' },
    { id: 's-bb1', rotulo: 'BB final 3310', codigo_banco: '001', conta_final: '3310' },
    { id: 's-bb2', rotulo: 'BB final 1200', codigo_banco: '001', conta_final: '1200' },
    { id: 's-cartao', rotulo: 'Nubank final 4455', cartao_final: '4455' },
  ],
};

describe('busca sem IA', () => {
  it('"itaú setembro" vira os chips Itaú final 0567 e Set/2026', () => {
    const r = interpretarBusca('itaú setembro', ctx);
    expect(r.chips).toEqual([
      { tipo: 'subtipo', valor: 's-itau', rotulo: 'Itaú final 0567' },
      { tipo: 'mes', valor: '2026-09-01', rotulo: 'Set/2026' },
    ]);
    expect(r.resto).toBe('');
  });
  it('mês sem ano depois do mês da tela é do ano anterior', () => {
    expect(interpretarBusca('dezembro', ctx).chips[0]).toMatchObject({ valor: '2025-12-01' });
  });
  it('banco com várias contas vira chip do banco; final escolhe a conta', () => {
    expect(interpretarBusca('bb', ctx).chips).toEqual([{ tipo: 'banco', valor: '001', rotulo: 'BB' }]);
    expect(interpretarBusca('3310', ctx).chips).toEqual([{ tipo: 'subtipo', valor: 's-bb1', rotulo: 'BB final 3310' }]);
    expect(interpretarBusca('4455', ctx).chips[0]).toMatchObject({ valor: 's-cartao' });
  });
  it('tipo pelo começo da palavra; o resto vira busca comum sem acento', () => {
    const r = interpretarBusca('extrato padaria São', ctx);
    expect(r.chips).toEqual([{ tipo: 'tipo', valor: 't-ext', rotulo: 'Extrato bancário' }]);
    expect(r.resto).toBe('padaria sao');
  });
  it('"notas" é ambíguo (entrada e saída) e vira texto', () => {
    expect(interpretarBusca('notas', ctx).chips).toEqual([]);
  });
});
