import { nomeCurtoDoBanco } from '@/lib/bancos';
import { anoMes, mesCurto } from '@/lib/tempo';
import { nomeDeDownload } from '@/lib/texto';

/**
 * Nomes GERADOS NA HORA a partir do tipo, do subtipo e do mês. Nada disso é
 * gravado: renomear um subtipo ou corrigir o mês atualiza todos os nomes.
 * O nome original do arquivo fica só nos detalhes.
 */
export interface DadosDoSubtipo {
  nome?: string | null;
  codigo_banco?: string | null;
  nome_banco?: string | null;
  conta_final?: string | null;
  cartao_final?: string | null;
  cartao_emissor?: string | null;
}

/** "Itaú final 0567", "Cartão Nubank final 3310", ou o nome livre. */
export function nomeDoSubtipo(s: DadosDoSubtipo | null | undefined, comFinal = true): string {
  if (!s) return '';
  if (s.conta_final) {
    const banco = nomeCurtoDoBanco(s.codigo_banco, s.nome_banco);
    return s.nome ? s.nome : comFinal ? `${banco} final ${s.conta_final}` : `${banco} ${s.conta_final}`;
  }
  if (s.cartao_final) {
    const emissor = s.cartao_emissor ? `${s.cartao_emissor} ` : '';
    return comFinal ? `${emissor}final ${s.cartao_final}` : `${emissor}${s.cartao_final}`;
  }
  return s.nome ?? '';
}

/** Nome curto do tipo para títulos de arquivo ("Extrato bancário" → "Extrato"). */
export function tipoCurto(nomeTipo: string): string {
  const m: Record<string, string> = { 'extrato bancário': 'Extrato', 'fatura de cartão': 'Fatura' };
  return m[nomeTipo.toLowerCase()] ?? nomeTipo;
}

/** "Extrato Itaú 0567 · Set/2026" */
export function nomeGerado(d: { tipo_nome?: string | null; subtipo?: DadosDoSubtipo | null; competencia?: string | null; nome_original: string }): string {
  if (!d.tipo_nome) return d.nome_original;
  const partes = [tipoCurto(d.tipo_nome)];
  const sub = nomeDoSubtipo(d.subtipo, false);
  if (sub) partes.push(sub);
  const base = partes.join(' ');
  return d.competencia ? `${base} · ${mesCurto(d.competencia)}` : base;
}

/** "Extrato_Itau_0567_2026-09.pdf": sem barra, acento nem caractere proibido no Windows; ano antes do mês. */
export function nomeDoDownload(d: { tipo_nome?: string | null; subtipo?: DadosDoSubtipo | null; competencia?: string | null; nome_original: string; extensao: string }): string {
  if (!d.tipo_nome) return nomeDeDownload([d.nome_original.replace(/\.[^.]+$/, '')], d.extensao);
  const partes = [tipoCurto(d.tipo_nome)];
  const sub = nomeDoSubtipo(d.subtipo, false);
  if (sub) partes.push(sub);
  if (d.competencia) partes.push(anoMes(d.competencia));
  return nomeDeDownload(partes, d.extensao);
}
