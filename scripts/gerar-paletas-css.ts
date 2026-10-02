/**
 * Gera os blocos `html[data-destaque="…"]` / `html.dark[data-destaque="…"]`
 * no src/app/globals.css a partir de src/lib/paletas.ts (única fonte dos
 * valores). O trecho fica entre os marcadores PALETAS:INICIO / PALETAS:FIM.
 *
 *   npm run paletas
 *
 * O `npm run contraste` confere, além do contraste, se o CSS gerado está em
 * dia com o paletas.ts — editar o bloco à mão não adianta.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cssDeTodasAsPaletas, MARCA_FIM, MARCA_INICIO } from '../src/lib/paletas.ts';

const arquivo = resolve(process.cwd(), 'src/app/globals.css');
const css = readFileSync(arquivo, 'utf8');
const bloco = `${MARCA_INICIO}\n${cssDeTodasAsPaletas()}\n${MARCA_FIM}`;

let novo: string;
const i = css.indexOf(MARCA_INICIO);
const f = css.indexOf(MARCA_FIM);
if (i >= 0 && f > i) {
  novo = css.slice(0, i) + bloco + css.slice(f + MARCA_FIM.length);
} else {
  // Primeira vez: entra antes da guarda de impressão, no fim das regras do app.
  const guarda = css.indexOf('GUARDA DE IMPRESS');
  let pos = guarda >= 0 ? css.lastIndexOf('/*', guarda) : css.length;
  if (pos < 0) pos = css.length;
  novo = css.slice(0, pos) + bloco + '\n\n' + css.slice(pos);
}
if (novo !== css) {
  writeFileSync(arquivo, novo);
  console.log('globals.css: bloco das paletas atualizado.');
} else {
  console.log('globals.css: bloco das paletas já estava em dia.');
}
