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

// Semente de documentos de demonstração (idempotente).
const sem = await fetch(`${BASE}/api/dev/semear`, { method: 'POST' });
console.log('semente:', sem.status, await sem.text());

import { resolve as caminho } from 'node:path';
const browser = await chromium.launch({ executablePath: CHROME, args: [
  '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-video-capture=${caminho(PASTA, 'camera.y4m')}`,
] });
const { pc, cel } = await contextos(browser);

// Rotas com {codi} (ex.: /clientes/{101}) viram o id da empresa da semente com aquele codi_emp.
import pg from 'pg';
import { carregarEnv } from './env.ts';
carregarEnv();
const banco = new pg.Client({ connectionString: process.env.DATABASE_URL });
await banco.connect();
const idsPorCodi = new Map((await banco.query<{ codi_emp: number; id: string }>('SELECT codi_emp, id FROM empresas')).rows.map((r) => [String(r.codi_emp), r.id]));
async function resolver(rota: string): Promise<string> {
  let r = rota.replace(/\{(\d+)\}/g, (_, c) => idsPorCodi.get(c) ?? c);
  const t = r.match(/\{tipo:([^}]+)\}/);
  if (t) {
    const d = await banco.query<{ id: string }>('SELECT id FROM tipos_documento WHERE nome ILIKE $1 LIMIT 1', [`${t[1]}%`]);
    r = r.replace(t[0], d.rows[0]?.id ?? 'x');
  }
  if (r.includes('{pedido}')) {
    const d = await banco.query<{ id: string }>('SELECT id FROM pedidos ORDER BY criado_em DESC LIMIT 1');
    r = r.replace('{pedido}', d.rows[0]?.id ?? 'x');
  }
  // {doc:...} = id do primeiro documento cujo nome original contém o texto.
  const m = r.match(/\{doc:([^}]+)\}/);
  if (m) {
    const d = await banco.query<{ id: string }>('SELECT id FROM documentos WHERE nome_original ILIKE $1 ORDER BY recebido_em DESC LIMIT 1', [`%${m[1]}%`]).catch(() => ({ rows: [] as { id: string }[] }));
    r = r.replace(m[0], d.rows[0]?.id ?? 'x');
  }
  return r;
}
const nomeDaRota = (rota: string) => rota.replace(/\{(\d+)\}/g, 'e$1').replace(/\{doc:[^}]+\}/g, 'doc').replace(/\{tipo:([^}]+)\}/g, '$1').replace('{pedido}', 'pedido').replace(/ /g, '_').replace(/[?&=]/g, '-').replace(/\//g, '-');
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
      const p = await entrar(ctx, ADMIN, await resolver(rota));
      await paleta(p, 'dourado', true);
      await foto(p, `funcionario${nomeDaRota(rota)}-${sufixo}`);
      await p.close();
    }
  }
}
if (quer('cliente')) {
  for (const rota of PAGINAS_CLI) {
    for (const [ctx, sufixo] of [[pc, 'pc'], [cel, 'cel']] as const) {
      const p = await entrar(ctx, CLIENTE, await resolver(rota));
      await foto(p, `cliente${nomeDaRota(rota)}-${sufixo}`);
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
if (quer('envio')) {
  // Câmera (scanner) no celular: detecta o papel, fotografa e revisa.
  {
    const p = await entrar(cel, CLIENTE, '/cliente');
    await p.context().grantPermissions(['camera']);
    await p.locator('.btn-escanear').first().click();
    await p.waitForSelector('.scanner video');
    await p.waitForFunction(() => !document.querySelector('.scanner-dica'), null, { timeout: 90000 });
    await p.waitForTimeout(2500); // o contorno ao vivo aparece a cada 400 ms
    await foto(p, 'cliente-camera-cel');
    await p.locator('.scanner-disparo').click();
    await p.waitForSelector('.scanner-mini', { timeout: 30000 });
    await p.locator('.scanner-disparo').click();
    await p.waitForFunction(() => document.querySelectorAll('.scanner-mini').length >= 2, null, { timeout: 30000 });
    await p.getByRole('button', { name: 'Concluir' }).click();
    await foto(p, 'cliente-camera-revisao-cel');
    await p.close();
  }
  // Popup com várias empresas (envio sem pedido de um login com duas empresas):
  // com CNPJ que bate (empresa já marcada) e sem CNPJ (nada marcado, Enviar travado).
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdfCom = async (texto: string) => {
    const d = await PDFDocument.create(); const pg = d.addPage([595, 842]); const f = await d.embedFont(StandardFonts.Helvetica);
    pg.drawText(texto, { x: 40, y: 780, size: 14, font: f });
    return Buffer.from(await d.save());
  };
  const casos: [string, string][] = [['com-cnpj', 'Comprovante de pagamento  CNPJ 11.222.333/0001-81'], ['sem-cnpj', 'Comprovante de pagamento']];
  for (const [nome, texto] of casos) {
    for (const [ctx, sufixo] of [[pc, 'pc'], [cel, 'cel']] as const) {
      if (nome === 'sem-cnpj' && sufixo === 'pc') continue;
      const p = await entrar(ctx, CLIENTE, '/cliente/enviar');
      const [escolha] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Anexar arquivo' }).first().click()]);
      await escolha.setFiles({ name: `${nome}-${Date.now()}.pdf`, mimeType: 'application/pdf', buffer: await pdfCom(`${texto}  ${Date.now()}`) });
      await p.getByRole('button', { name: 'Não', exact: true }).click();
      await p.waitForSelector('text=Confirmar envio', { timeout: 30000 });
      await p.waitForTimeout(800);
      await foto(p, `cliente-popup-${nome}-${sufixo}`);
      await p.close();
    }
  }
  // QR code no computador: "Tirar foto" num item pendente.
  {
    const p = await entrar(pc, CLIENTE, '/cliente');
    await p.getByRole('button', { name: 'Tirar foto' }).first().click();
    await p.waitForSelector('img[alt^="QR code"]', { timeout: 15000 });
    await foto(p, 'cliente-qr-pc');
    await p.close();
  }
}
await browser.close();
await banco.end();
