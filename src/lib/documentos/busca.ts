import { normalizarBusca } from '@/lib/texto';
import { reconhecerMes, mesCurto, somarMeses } from '@/lib/tempo';
import { apelidosDoBanco, nomeCurtoDoBanco } from '@/lib/bancos';

/**
 * Busca da pasta do cliente, SEM IA. O que for digitado é comparado com os
 * tipos, os bancos, os finais de conta/cartão e os meses daquela empresa. O
 * que for reconhecido vira um chip de filtro; o resto vira busca comum, sem
 * diferenciar acentos. Ex.: "itaú setembro" → [Itaú final 0567] [Set/2026].
 */
export type Chip =
  | { tipo: 'tipo'; valor: string; rotulo: string }
  | { tipo: 'subtipo'; valor: string; rotulo: string }
  | { tipo: 'banco'; valor: string; rotulo: string }
  | { tipo: 'mes'; valor: string; rotulo: string };

export interface ContextoBusca {
  tipos: { id: string; nome: string }[];
  subtipos: { id: string; rotulo: string; codigo_banco?: string | null; nome_banco?: string | null; conta_final?: string | null; cartao_final?: string | null; nome?: string | null }[];
  competenciaAtual: string;  // mês selecionado na tela, para inferir o ano
}

export function interpretarBusca(texto: string, ctx: ContextoBusca): { chips: Chip[]; resto: string } {
  const palavras = normalizarBusca(texto).split(/\s+/).filter(Boolean);
  const usadas = new Set<number>();
  const chips: Chip[] = [];
  const ano = Number(ctx.competenciaAtual.slice(0, 4));

  palavras.forEach((p, i) => {
    // Mês: "setembro", "set", "set/2026", "09/2026". Sem ano: o mais recente que não passa do mês da tela.
    const mes = reconhecerMes(p, ano);
    if (mes) {
      const temAno = /\d{4}/.test(p);
      const valor = !temAno && mes > ctx.competenciaAtual ? somarMeses(mes, -12) : mes;
      chips.push({ tipo: 'mes', valor, rotulo: mesCurto(valor) });
      usadas.add(i);
      return;
    }
    // Final de conta ou cartão (3 ou 4 dígitos).
    if (/^\d{3,4}$/.test(p)) {
      const achados = ctx.subtipos.filter((s) => (s.conta_final && s.conta_final.endsWith(p)) || (s.cartao_final && s.cartao_final.endsWith(p)));
      if (achados.length) { achados.forEach((s) => chips.push({ tipo: 'subtipo', valor: s.id, rotulo: s.rotulo })); usadas.add(i); return; }
    }
    if (p.length < 2) return;
    // Banco: "itau", "sicredi", "bb", "nubank"…
    const doBanco = ctx.subtipos.filter((s) => s.codigo_banco && apelidosDoBanco(s.codigo_banco, s.nome_banco).some((a) => normalizarBusca(a) === p || (p.length >= 3 && normalizarBusca(a).startsWith(p))));
    if (doBanco.length === 1) { chips.push({ tipo: 'subtipo', valor: doBanco[0].id, rotulo: doBanco[0].rotulo }); usadas.add(i); return; }
    if (doBanco.length > 1) {
      const codigo = doBanco[0].codigo_banco!;
      chips.push({ tipo: 'banco', valor: codigo, rotulo: nomeCurtoDoBanco(codigo, doBanco[0].nome_banco) });
      usadas.add(i); return;
    }
    // Subtipo livre pelo nome.
    if (p.length >= 3) {
      const livre = ctx.subtipos.filter((s) => s.nome && normalizarBusca(s.nome).split(/\s+/).some((w) => w.startsWith(p)));
      if (livre.length === 1) { chips.push({ tipo: 'subtipo', valor: livre[0].id, rotulo: livre[0].rotulo }); usadas.add(i); return; }
    }
    // Tipo: começo de qualquer palavra do nome do tipo (3+ letras): "extrato", "fatura", "notas"…
    if (p.length >= 3) {
      const tipos = ctx.tipos.filter((t) => normalizarBusca(t.nome).split(/\s+/).some((w) => w.length >= 3 && w.startsWith(p)));
      if (tipos.length === 1) { chips.push({ tipo: 'tipo', valor: tipos[0].id, rotulo: tipos[0].nome }); usadas.add(i); }
    }
  });
  // Sem chips repetidos.
  const unicos = chips.filter((c, i) => chips.findIndex((x) => x.tipo === c.tipo && x.valor === c.valor) === i);
  return { chips: unicos, resto: palavras.filter((_, i) => !usadas.has(i)).join(' ') };
}

/** Chips → parâmetros de URL (para a busca sobreviver a recarregar e compartilhar o link). */
export function chipsParaParametros(chips: Chip[]): Record<string, string> {
  const p: Record<string, string> = {};
  const sub = chips.filter((c) => c.tipo === 'subtipo').map((c) => c.valor);
  const ban = chips.filter((c) => c.tipo === 'banco').map((c) => c.valor);
  const tipo = chips.find((c) => c.tipo === 'tipo');
  const mes = chips.find((c) => c.tipo === 'mes');
  if (sub.length) p.sub = sub.join(',');
  if (ban.length) p.banco = ban.join(',');
  if (tipo) p.tipo = tipo.valor;
  if (mes) p.m = mes.valor;
  return p;
}
