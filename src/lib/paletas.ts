/**
 * Paletas da cor de destaque do app (Ajustes › Estética).
 *
 * ÚNICA fonte dos valores: o CSS (`html[data-destaque="…"]` no globals.css)
 * é gerado daqui por `npm run paletas`, e `npm run contraste` confere o
 * contraste de cada paleta × tema × intensidade do fundo e se o CSS gerado
 * está em dia.
 *
 * Regras:
 * - Tudo já calculado, em hex / rgb / rgba. Nada de color-mix() ou oklch(): o
 *   exportToPDF usa html2canvas 1.4.1, que só entende rgb/rgba/hsl/hsla.
 * - `primary` e `ring` são trios HSL ("42 50% 39%"), porque o tailwind.config
 *   monta hsl(var(--primary)).
 * - O Dourado é o padrão e, nos tons que já existiam (CTA, variações e séries
 *   do gráfico), mantém os valores de sempre.
 * - Fora deste arquivo e dos tokens do globals.css, nenhuma cor de destaque é
 *   escrita à mão (rg -i "c9a961|201, ?169, ?97|1c1709" src).
 */

export const IDS_PALETA = ['dourado', 'cobre', 'safira', 'petroleo', 'ametista', 'grafite'] as const;
export type IdPaleta = (typeof IDS_PALETA)[number];
export const PALETA_PADRAO: IdPaleta = 'dourado';

export interface TemaPaleta {
  /** Cor de destaque tematizada (--destaque) e os canais dela (--destaque-rgb). */
  destaque: string;
  /** Texto na cor de destaque (--destaque-text), já com contraste para o tema. */
  texto: string;
  /** Texto SOBRE a cor de destaque (--on-destaque): escuro ou branco, conforme a paleta. */
  sobre: string;
  /** Brilho e linha: a cor de destaque com alfa (--destaque-glow, --destaque-line). */
  brilho: string;
  linha: string;
  /** Variações para degradês e hovers (--destaque-2/3/claro/escuro-rgb). */
  tons: { d2: string; d3: string; claro: string; escuro: string };
  /** Séries do gráfico de quotas (--destaque-serie-1..6). */
  series: [string, string, string, string, string, string];
  /** Degradê do CTA, normal e hover (--cta, --cta-hover). */
  cta: [string, string];
  ctaHover: [string, string];
  /** Manchas do fundo (--orb1/--orb3): cor e fator multiplicado pela intensidade (--gi). */
  manchas: { orb1: [number, number, number]; k1: number; orb3: [number, number, number]; k3: number };
  /** Trios HSL do shadcn (--primary, --ring). */
  primary: string;
  ring: string;
}

export interface Paleta {
  id: IdPaleta;
  nome: string;
  resumo: string;
  /** Cor da amostra no seletor. */
  amostra: string;
  claro: TemaPaleta;
  escuro: TemaPaleta;
}

export const PALETAS: Record<IdPaleta, Paleta> = {
  dourado: {
    id: 'dourado',
    nome: 'Dourado',
    resumo: 'A identidade clássica do escritório.',
    amostra: '#C9A961',
    claro: {
      destaque: '#957832', texto: '#6C5624', sobre: '#1c1709',
      brilho: 'rgba(149, 120, 50, 0.13)', linha: 'rgba(149, 120, 50, 0.36)',
      tons: { d2: '#B89850', d3: '#A78740', claro: '#D4B775', escuro: '#8A6F30' },
      series: ['#C9A961', '#8A6F30', '#E2CB92', '#B08D4F', '#D4B775', '#6E5726'],
      cta: ['#B8964F', '#A3833D'], ctaHover: ['#C4A35C', '#B39150'],
      manchas: { orb1: [211, 185, 124], k1: 0.8, orb3: [206, 182, 126], k3: 0.62 },
      primary: '42 50% 39%', ring: '42 50% 39%',
    },
    escuro: {
      destaque: '#C9A961', texto: '#C9A961', sobre: '#1c1709',
      brilho: 'rgba(201, 169, 97, 0.1)', linha: 'rgba(201, 169, 97, 0.3)',
      tons: { d2: '#B89850', d3: '#A78740', claro: '#D4B775', escuro: '#8A6F30' },
      series: ['#C9A961', '#8A6F30', '#E2CB92', '#B08D4F', '#D4B775', '#6E5726'],
      cta: ['#B8964F', '#A3833D'], ctaHover: ['#C4A35C', '#B39150'],
      manchas: { orb1: [87, 70, 29], k1: 0.55, orb3: [79, 65, 30], k3: 0.4 },
      primary: '42 49% 58%', ring: '42 49% 58%',
    },
  },
  cobre: {
    id: 'cobre',
    nome: 'Cobre',
    resumo: 'Quente e terroso, um degrau abaixo do dourado.',
    amostra: '#E1A88C',
    claro: {
      destaque: '#BF6233', texto: '#8A4725', sobre: '#1c1709',
      brilho: 'rgba(191, 98, 51, 0.13)', linha: 'rgba(191, 98, 51, 0.36)',
      tons: { d2: '#C46434', d3: '#B65D30', claro: '#DDA081', escuro: '#8A4725' },
      series: ['#BF6233', '#8A4725', '#E1A88C', '#D07A4F', '#D8916D', '#6C371D'],
      cta: ['#CD7042', '#CA6838'], ctaHover: ['#D07A4F', '#CD7244'],
      manchas: { orb1: [222, 178, 157], k1: 0.8, orb3: [217, 176, 155], k3: 0.62 },
      primary: '20 58% 47%', ring: '20 58% 47%',
    },
    escuro: {
      destaque: '#E1A88C', texto: '#E1A88C', sobre: '#1c1709',
      brilho: 'rgba(225, 168, 140, 0.1)', linha: 'rgba(225, 168, 140, 0.3)',
      tons: { d2: '#D58963', d3: '#CD7042', claro: '#EBC7B5', escuro: '#A2532B' },
      series: ['#E1A88C', '#A2532B', '#EECEBE', '#D28057', '#E8BCA7', '#7C3F21'],
      cta: ['#D58963', '#CD7042'], ctaHover: ['#D99471', '#D17D53'],
      manchas: { orb1: [108, 60, 36], k1: 0.55, orb3: [96, 56, 37], k3: 0.4 },
      primary: '20 59% 72%', ring: '20 59% 72%',
    },
  },
  safira: {
    id: 'safira',
    nome: 'Safira',
    resumo: 'Azul profundo, sóbrio e institucional.',
    amostra: '#99B6E7',
    claro: {
      destaque: '#467AD4', texto: '#2757A8', sobre: '#FFFFFF',
      brilho: 'rgba(70, 122, 212, 0.13)', linha: 'rgba(70, 122, 212, 0.36)',
      tons: { d2: '#4B7DD5', d3: '#3D74D2', claro: '#8FAFE5', escuro: '#2757A8' },
      series: ['#467AD4', '#2757A8', '#99B6E7', '#6590DB', '#7FA3E1', '#1F4383'],
      cta: ['#366ED0', '#2C60BB'], ctaHover: ['#4277D3', '#3069CB'],
      manchas: { orb1: [167, 189, 226], k1: 0.8, orb3: [165, 185, 221], k3: 0.62 },
      primary: '218 62% 55%', ring: '218 62% 55%',
    },
    escuro: {
      destaque: '#99B6E7', texto: '#99B6E7', sobre: '#1c1709',
      brilho: 'rgba(153, 182, 231, 0.1)', linha: 'rgba(153, 182, 231, 0.3)',
      tons: { d2: '#769CDF', d3: '#5B89D8', claro: '#BDD0F0', escuro: '#2E65C5' },
      series: ['#99B6E7', '#2E65C5', '#C5D5F1', '#6C95DD', '#B0C7ED', '#234E97'],
      cta: ['#769CDF', '#5B89D8'], ctaHover: ['#82A5E2', '#6993DC'],
      manchas: { orb1: [41, 72, 124], k1: 0.55, orb3: [41, 66, 109], k3: 0.4 },
      primary: '218 62% 75%', ring: '218 62% 75%',
    },
  },
  petroleo: {
    id: 'petroleo',
    nome: 'Petróleo',
    resumo: 'Verde-azulado, frio e discreto.',
    amostra: '#5AC4CF',
    claro: {
      destaque: '#2A8792', texto: '#1F6269', sobre: '#FFFFFF',
      brilho: 'rgba(42, 135, 146, 0.13)', linha: 'rgba(42, 135, 146, 0.36)',
      tons: { d2: '#2B8A95', d3: '#28818B', claro: '#48BDCA', escuro: '#1F6269' },
      series: ['#2A8792', '#1F6269', '#5AC4CF', '#319EAA', '#37B1BF', '#184C52'],
      cta: ['#277C85', '#226D75'], ctaHover: ['#29848E', '#25767F'],
      manchas: { orb1: [118, 200, 209], k1: 0.8, orb3: [122, 196, 204], k3: 0.62 },
      primary: '186 55% 37%', ring: '186 55% 37%',
    },
    escuro: {
      destaque: '#5AC4CF', texto: '#5AC4CF', sobre: '#1c1709',
      brilho: 'rgba(90, 196, 207, 0.1)', linha: 'rgba(90, 196, 207, 0.3)',
      tons: { d2: '#35AAB7', d3: '#2F96A1', claro: '#98DAE1', escuro: '#24737B' },
      series: ['#5AC4CF', '#24737B', '#A5DEE5', '#33A3AF', '#83D2DB', '#1B585E'],
      cta: ['#35AAB7', '#2F96A1'], ctaHover: ['#38B3C1', '#32A0AD'],
      manchas: { orb1: [28, 79, 85], k1: 0.55, orb3: [29, 72, 77], k3: 0.4 },
      primary: '186 55% 58%', ring: '186 55% 58%',
    },
  },
  ametista: {
    id: 'ametista',
    nome: 'Ametista',
    resumo: 'Violeta suave, para destacar sem gritar.',
    amostra: '#C7A9E1',
    claro: {
      destaque: '#9963C8', texto: '#773CAA', sobre: '#FFFFFF',
      brilho: 'rgba(153, 99, 200, 0.13)', linha: 'rgba(153, 99, 200, 0.36)',
      tons: { d2: '#9C67CA', d3: '#945CC6', claro: '#C1A1DE', escuro: '#773CAA' },
      series: ['#9963C8', '#773CAA', '#C7A9E1', '#AA7DD1', '#B893D9', '#5D2F85'],
      cta: ['#9056C3', '#8442BD'], ctaHover: ['#9760C7', '#8C4FC1'],
      manchas: { orb1: [204, 177, 228], k1: 0.8, orb3: [201, 174, 224], k3: 0.62 },
      primary: '272 48% 59%', ring: '272 48% 59%',
    },
    escuro: {
      destaque: '#C7A9E1', texto: '#C7A9E1', sobre: '#1c1709',
      brilho: 'rgba(199, 169, 225, 0.1)', linha: 'rgba(199, 169, 225, 0.3)',
      tons: { d2: '#B38BD6', d3: '#A474CE', claro: '#DBC7EB', escuro: '#894ABF' },
      series: ['#C7A9E1', '#894ABF', '#DFCEEE', '#AE83D3', '#D4BDE8', '#6B3699'],
      cta: ['#B38BD6', '#A474CE'], ctaHover: ['#BA95DA', '#AC80D3'],
      manchas: { orb1: [96, 49, 138], k1: 0.55, orb3: [88, 47, 123], k3: 0.4 },
      primary: '272 48% 77%', ring: '272 48% 77%',
    },
  },
  grafite: {
    id: 'grafite',
    nome: 'Grafite',
    resumo: 'Cinza-azulado, quase neutro.',
    amostra: '#B1B5BB',
    claro: {
      destaque: '#757C87', texto: '#545A61', sobre: '#FFFFFF',
      brilho: 'rgba(117, 124, 135, 0.13)', linha: 'rgba(117, 124, 135, 0.36)',
      tons: { d2: '#787F89', d3: '#6F7680', claro: '#A9AEB4', escuro: '#545A61' },
      series: ['#757C87', '#545A61', '#B1B5BB', '#8B919A', '#9DA2AA', '#42464B'],
      cta: ['#6B727B', '#5E646C'], ctaHover: ['#727983', '#666D76'],
      manchas: { orb1: [184, 188, 193], k1: 0.8, orb3: [180, 185, 190], k3: 0.62 },
      primary: '217 7% 49%', ring: '217 7% 49%',
    },
    escuro: {
      destaque: '#B1B5BB', texto: '#B1B5BB', sobre: '#1c1709',
      brilho: 'rgba(177, 181, 187, 0.1)', linha: 'rgba(177, 181, 187, 0.3)',
      tons: { d2: '#969CA4', d3: '#838A93', claro: '#CCCFD3', escuro: '#636972' },
      series: ['#B1B5BB', '#636972', '#D2D4D8', '#8F969E', '#C2C6CA', '#4C5057'],
      cta: ['#969CA4', '#838A93'], ctaHover: ['#9FA4AC', '#8D939C'],
      manchas: { orb1: [68, 73, 79], k1: 0.55, orb3: [63, 67, 72], k3: 0.4 },
      primary: '216 7% 71%', ring: '216 7% 71%',
    },
  },
};

export function ehIdPaleta(valor: unknown): valor is IdPaleta {
  return typeof valor === 'string' && (IDS_PALETA as readonly string[]).includes(valor);
}

/** "#957832" → "149 120 50" (canais separados por espaço, para rgb(var(--x) / a)). */
export function hexParaCanais(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export const MARCA_INICIO = '/* ═══ PALETAS:INICIO — gerado por `npm run paletas` a partir de src/lib/paletas.ts. NÃO edite à mão. ═══ */';
export const MARCA_FIM = '/* ═══ PALETAS:FIM ═══ */';

/** Declarações CSS de um tema de uma paleta (uma por linha, com dois espaços). */
export function declaracoesDoTema(t: TemaPaleta): string[] {
  const m = t.manchas;
  return [
    `--destaque: ${t.destaque};`,
    `--destaque-text: ${t.texto};`,
    `--destaque-glow: ${t.brilho};`,
    `--destaque-line: ${t.linha};`,
    `--on-destaque: ${t.sobre};`,
    `--destaque-rgb: ${hexParaCanais(t.destaque)};`,
    `--destaque-2-rgb: ${hexParaCanais(t.tons.d2)};`,
    `--destaque-3-rgb: ${hexParaCanais(t.tons.d3)};`,
    `--destaque-claro-rgb: ${hexParaCanais(t.tons.claro)};`,
    `--destaque-escuro-rgb: ${hexParaCanais(t.tons.escuro)};`,
    ...t.series.map((s, i) => `--destaque-serie-${i + 1}: ${s};`),
    `--cta: linear-gradient(90deg, ${t.cta[0]}, ${t.cta[1]});`,
    `--cta-hover: linear-gradient(90deg, ${t.ctaHover[0]}, ${t.ctaHover[1]});`,
    `--orb1: rgba(${m.orb1.join(', ')}, calc(${m.k1} * var(--gi)));`,
    `--orb3: rgba(${m.orb3.join(', ')}, calc(${m.k3} * var(--gi)));`,
    // Canais soltos: o fundo do celular (.app-bg-mobile) usa a cor da paleta com o fator dele.
    `--orb1-rgb: ${m.orb1.join(' ')};`,
    `--orb3-rgb: ${m.orb3.join(' ')};`,
    `--primary: ${t.primary};`,
    `--ring: ${t.ring};`,
  ];
}

export function cssDaPaleta(p: Paleta): string {
  const bloco = (seletor: string, t: TemaPaleta) =>
    `${seletor} {\n${declaracoesDoTema(t).map((d) => `  ${d}`).join('\n')}\n}`;
  return [
    `/* ${p.nome} — ${p.resumo} */`,
    bloco(`html[data-destaque="${p.id}"]`, p.claro),
    bloco(`html.dark[data-destaque="${p.id}"]`, p.escuro),
  ].join('\n');
}

export function cssDeTodasAsPaletas(): string {
  return IDS_PALETA.map((id) => cssDaPaleta(PALETAS[id])).join('\n\n');
}
