/**
 * Capturas de tela com Playwright (npm run capturas), no computador
 * (1440×900) e no celular (iPhone 390×844 com área segura). Precisa do app
 * rodando com DEV_LOGIN=1 (ver scripts/capturas.sh). Também prova que
 * nenhuma barra cobre conteúdo: rola a lista longa da /demo até o fim e
 * confere que a última linha fica inteira acima da barra de abas.
 */
import { chromium, devices, type Browser, type BrowserContext } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.CAPTURAS_URL || 'http://localhost:3000';
const PASTA = process.env.CAPTURAS_PASTA || 'capturas';
const PALETAS = ['dourado', 'cobre', 'safira', 'petroleo', 'ametista', 'grafite'];
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(PASTA, { recursive: true });

const so = process.argv.slice(2);
const quer = (nome: string) => so.length === 0 || so.some((s) => nome.includes(s));

async function contextos(browser: Browser) {
  const pc = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'pt-BR' });
  const iphone = devices['iPhone 14'];
  const cel = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, locale: 'pt-BR', isMobile: true, hasTouch: true });
  // Área segura do iPhone (gesto de 34px): simulamos o env() com as variáveis do CSS.
  await cel.addInitScript(() => {
    const s = document.createElement('style');
    s.textContent = ':root{--safe-b:34px;--safe-t:47px}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
  });
  return { pc, cel };
}

async function entrar(ctx: BrowserContext, como: string, destino: string) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/api/dev/entrar?como=${encodeURIComponent(como)}&destino=${encodeURIComponent(destino)}`, { waitUntil: 'networkidle' });
  return p;
}
async function foto(p: import('playwright').Page, nome: string, full = false) {
  await p.waitForTimeout(350);
  await p.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: full });
  console.log('captura:', nome);
}
async function paleta(p: import('playwright').Page, id: string, escuro = true) {
  // Grava no servidor (a fonte da verdade) e no cache local, depois recarrega.
  await p.evaluate(async ([id, escuro]) => {
    const prefs = { mode: 'manchas', animate: false, speed: 2, goldIntensity: 0.5, glassIntensity: 'sutil', glassOpacity: 100, reduceTransparency: false, reduceMotion: true, destaque: id, tema: escuro ? 'escuro' : 'claro' };
    localStorage.setItem('pd.estetica', JSON.stringify(prefs));
    localStorage.setItem('theme', escuro ? 'dark' : 'light');
    await fetch('/api/preferencias/estetica', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefs }) });
  }, [id, escuro] as [string, boolean]);
  await p.goto(p.url(), { waitUntil: 'networkidle' });
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const { pc, cel } = await contextos(browser);

const PAGINAS_FUNC = (process.env.CAPTURAS_FUNC || '/inicio,/ajustes/estetica').split(',');
const PAGINAS_CLI = (process.env.CAPTURAS_CLI || '/cliente').split(',');
const ADMIN = 'ana@escritorio.com.br';
const CLIENTE = 'carlos@padaria.com.br';

if (quer('paletas')) {
  for (const id of PALETAS) {
    for (const [ctx, sufixo] of [[pc, 'pc'], [cel, 'cel']] as const) {
      const p = await entrar(ctx, ADMIN, PAGINAS_FUNC[0]);
      await paleta(p, id, true);
      await foto(p, `funcionario-${id}-escuro-${sufixo}`);
      if (id === 'dourado') { await paleta(p, id, false); await foto(p, `funcionario-${id}-claro-${sufixo}`); }
      await p.close();
    }
  }
}
if (quer('funcionario')) {
  for (const rota of PAGINAS_FUNC) {
    for (const [ctx, sufixo] of [[pc, 'pc'], [cel, 'cel']] as const) {
      const p = await entrar(ctx, ADMIN, rota);
      await paleta(p, 'dourado', true);
      await foto(p, `funcionario${rota.replace(/\//g, '-')}-${sufixo}`);
      await p.close();
    }
  }
}
if (quer('cliente')) {
  for (const rota of PAGINAS_CLI) {
    for (const [ctx, sufixo] of [[pc, 'pc'], [cel, 'cel']] as const) {
      const p = await entrar(ctx, CLIENTE, rota);
      await foto(p, `cliente${rota.replace(/\//g, '-')}-${sufixo}`);
      await p.close();
    }
  }
}
if (quer('publicas')) {
  for (const rota of ['/entrar', '/instalar']) {
    for (const [ctx, sufixo] of [[pc, 'pc'], [cel, 'cel']] as const) {
      const p = await ctx.newPage();
      await p.goto(`${BASE}${rota}`, { waitUntil: 'networkidle' });
      await foto(p, `publica${rota.replace(/\//g, '-')}-${sufixo}`);
      await p.close();
    }
  }
}
if (quer('barras')) {
  // Prova: no iPhone, rolando até o fim de uma lista longa, nenhuma barra cobre conteúdo.
  for (const ponta of ['escritorio', 'cliente']) {
    const p = await cel.newPage();
    await p.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
    if (ponta === 'cliente') await p.locator('.seg-item', { hasText: 'Cliente' }).first().click(); await p.waitForTimeout(300);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const ultimas = [...document.querySelectorAll('[data-teste="ultima"]')]; if (ultimas.length !== 1) return { erro: 'conteúdo duplicado: ' + ultimas.length, ok: false }; const ultima = ultimas[0].getBoundingClientRect();
      const barra = document.querySelector('.tabbar')!.getBoundingClientRect();
      return { ultimaBottom: Math.round(ultima.bottom), barraTop: Math.round(barra.top), ok: ultima.bottom <= barra.top };
    });
    console.log(`barras (${ponta}):`, JSON.stringify(r));
    if (!r.ok) { console.error('FALHOU: a barra de abas cobre a última linha'); process.exitCode = 1; }
    await foto(p, `iphone-lista-longa-fim-${ponta}`);
    await p.close();
  }
}
await browser.close();
