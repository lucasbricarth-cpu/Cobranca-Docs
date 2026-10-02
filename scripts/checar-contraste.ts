/**
 * Teste de contraste das paletas (npm run contraste).
 *
 * Para cada paleta × tema (claro, escuro) × intensidade do fundo (goldIntensity
 * 0 e 1,5) — 24 combinações — confere, contra os fundos em que o texto e os
 * componentes de fato aparecem:
 *
 *   texto  ≥ 4,5:1  --destaque-text sobre os painéis e cartões de vidro;
 *                   --on-destaque sobre os dois tons do degradê do CTA;
 *   não-texto ≥ 3:1 (WCAG 1.4.11)  --destaque como borda e --ring como anel de
 *                   foco sobre os mesmos fundos; --on-destaque como ícone sobre
 *                   a cor de destaque sólida (selo com check).
 *
 * Fundos modelados como o app pinta: base do tema; a mancha (--orb1, alfa =
 * k × intensidade, a 70% do pico, que é o que chega sob um painel perto do
 * centro dela) sobre a base; e, sobre cada um desses, os dois primeiros tons
 * do vidro de painel (branco a 74%/44% no claro, 7,5%/3% no escuro) e o
 * cartão (--glass-2). Intensidade 0 = sem mancha.
 *
 * O limite nunca se afrouxa para uma paleta passar: ajusta-se o tom no
 * src/lib/paletas.ts. O script também falha se o bloco gerado no globals.css
 * estiver desatualizado ou se os tokens base (:root/.dark) divergirem do
 * Dourado, que é a paleta padrão.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  IDS_PALETA, PALETAS, MARCA_FIM, MARCA_INICIO, cssDeTodasAsPaletas, declaracoesDoTema,
} from '../src/lib/paletas.ts';
import type { TemaPaleta } from '../src/lib/paletas.ts';

type RGB = [number, number, number];
const BASE: Record<'claro' | 'escuro', RGB> = { claro: [238, 231, 216], escuro: [15, 14, 12] };
const VIDRO: Record<'claro' | 'escuro', number[]> = { claro: [0.74, 0.44], escuro: [0.075, 0.03] };
const CARTAO: Record<'claro' | 'escuro', number> = { claro: 0.42, escuro: 0.045 };
const PICO_DA_MANCHA = 0.7;
const INTENSIDADES = [0, 1.5];

function hex(h: string): RGB {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminancia([r, g, b]: RGB): number {
  const c = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function contraste(a: RGB, b: RGB): number {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function sobre(topo: RGB, alfa: number, fundo: RGB): RGB {
  return [0, 1, 2].map((i) => topo[i] * alfa + fundo[i] * (1 - alfa)) as RGB;
}
function fundos(tema: 'claro' | 'escuro', t: TemaPaleta, gi: number): Array<[string, RGB]> {
  const base = BASE[tema];
  const alfa = Math.min(1, PICO_DA_MANCHA * t.manchas.k1 * gi);
  const bases: Array<[string, RGB]> = [['base', base]];
  if (gi > 0) bases.push(['mancha', sobre(t.manchas.orb1, alfa, base)]);
  const out: Array<[string, RGB]> = [];
  for (const [nome, b] of bases) {
    VIDRO[tema].forEach((al, i) => out.push([`painel${i + 1}/${nome}`, sobre([255, 255, 255], al, b)]));
    out.push([`cartão/${nome}`, sobre([255, 255, 255], CARTAO[tema], b)]);
  }
  return out;
}
function pior(cor: RGB, bgs: Array<[string, RGB]>): [number, string] {
  let min: [number, string] = [Infinity, ''];
  for (const [n, bg] of bgs) { const r = contraste(cor, bg); if (r < min[0]) min = [r, n]; }
  return min;
}

const falhas: string[] = [];
const linhas: string[] = [];
const f2 = (n: number) => n.toFixed(2).padStart(5);
for (const id of IDS_PALETA) {
  const p = PALETAS[id];
  for (const tema of ['claro', 'escuro'] as const) {
    const t = p[tema];
    for (const gi of INTENSIDADES) {
      const bgs = fundos(tema, t, gi);
      const [rt, nt] = pior(hex(t.texto), bgs);
      const [rb, nb] = pior(hex(t.destaque), bgs);
      const [rr, nr] = pior(hex(t.ring.split(' ').length === 3 ? t.destaque : t.ring), bgs); // ring é trio HSL da mesma cor
      const rc = Math.min(...t.cta.map((c) => contraste(hex(c), hex(t.sobre))));
      const ri = contraste(hex(t.destaque), hex(t.sobre));
      const combo = `${p.nome.padEnd(9)} ${tema.padEnd(6)} gi=${String(gi).padEnd(3)}`;
      linhas.push(`${combo} texto ${f2(rt)} (${nt})  borda ${f2(rb)} (${nb})  anel ${f2(rr)}  sobre/CTA ${f2(rc)}  sobre/destaque ${f2(ri)}`);
      if (rt < 4.5) falhas.push(`${combo}: texto ${rt.toFixed(2)} < 4,5 (${nt})`);
      if (rb < 3) falhas.push(`${combo}: borda (--destaque) ${rb.toFixed(2)} < 3 (${nb})`);
      if (rr < 3) falhas.push(`${combo}: anel (--ring) ${rr.toFixed(2)} < 3 (${nr})`);
      if (rc < 4.5) falhas.push(`${combo}: --on-destaque sobre o CTA ${rc.toFixed(2)} < 4,5`);
      if (ri < 3) falhas.push(`${combo}: --on-destaque sobre --destaque ${ri.toFixed(2)} < 3`);
    }
  }
}
console.log(linhas.join('\n'));

// ── CSS gerado em dia? ──
const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
const i = css.indexOf(MARCA_INICIO), f = css.indexOf(MARCA_FIM);
if (i < 0 || f < i) falhas.push('globals.css: bloco das paletas não encontrado — rode `npm run paletas`.');
else if (css.slice(i + MARCA_INICIO.length, f).trim() !== cssDeTodasAsPaletas().trim()) {
  falhas.push('globals.css: bloco das paletas desatualizado em relação a src/lib/paletas.ts — rode `npm run paletas`.');
}

// ── tokens base (:root / .dark) = Dourado ──
// Fora do bloco gerado, cada token aparece duas vezes: a primeira no :root
// (claro) e a segunda no .dark (escuro).
const semGerado = css.slice(0, i) + css.slice(f + MARCA_FIM.length);
for (const [nome, t, indice] of [['claro', PALETAS.dourado.claro, 0], ['escuro', PALETAS.dourado.escuro, 1]] as const) {
  for (const d of declaracoesDoTema(t)) {
    const [prop, valor] = d.replace(/;$/, '').split(/:\s*/, 2);
    const re = new RegExp(`(^|[\\s{])${prop.replace(/-/g, '\\-')}:\\s*([^;]+);`, 'g');
    const achados = [...semGerado.matchAll(re)].map((m) => m[2].trim().replace(/\s+/g, ' '));
    // Token sem valor próprio no .dark herda o do :root (ex.: séries, CTA).
    const achado = achados[indice] ?? achados[0] ?? '(ausente)';
    const esperado = valor.replace(/\s+/g, ' ');
    if (achado !== esperado) falhas.push(`globals.css (${nome}): ${prop} = ${achado}, mas o Dourado define ${esperado}`);
  }
}

if (falhas.length) {
  console.error('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log(`\nOK: ${IDS_PALETA.length} paletas × 2 temas × ${INTENSIDADES.length} intensidades passam; CSS gerado em dia; tokens base = Dourado.`);
