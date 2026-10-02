import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cor de destaque do app (padrão Dourado; a paleta redefine --destaque-*).
        // Canais em var() para o modificador de opacidade funcionar: bg-destaque/10.
        destaque: {
          DEFAULT: 'rgb(var(--destaque-rgb) / <alpha-value>)',
          2: 'rgb(var(--destaque-2-rgb) / <alpha-value>)',
          3: 'rgb(var(--destaque-3-rgb) / <alpha-value>)',
          claro: 'rgb(var(--destaque-claro-rgb) / <alpha-value>)',
          escuro: 'rgb(var(--destaque-escuro-rgb) / <alpha-value>)',
        },
        'on-destaque': 'var(--on-destaque)',
        fg: { DEFAULT: 'var(--fg)', 2: 'var(--fg-2)', 3: 'var(--fg-3)', 4: 'var(--fg-4)' },
        base: 'rgb(var(--base-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-merriweather)', 'Merriweather', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
