/**
 * Estética do app — preferências de fundo, vidro, paleta e tema DO USUÁRIO
 * (funcionário), em Ajustes › Estética. Adaptado do handoff_estetica_app
 * (referencia/src/lib/backgroundPrefs.ts).
 *
 * Fonte da verdade: usuarios.estetica (JSONB), via /api/preferencias/estetica,
 * uma linha por usuário. O localStorage é só cache do primeiro paint e é
 * apagado ao sair da conta.
 *
 * Neste app o ESCURO é o tema padrão e as rotas do cliente, o /entrar e os
 * links dos e-mails são públicas: ficam sempre no Dourado (prompt §0).
 *
 * Este módulo é compartilhado entre servidor e cliente de propósito: nada
 * vindo do navegador entra no banco sem passar por normalizarPrefs().
 */

import { ehIdPaleta, PALETA_PADRAO, type IdPaleta } from '@/lib/paletas';

export type ModoFundo = 'gradiente' | 'manchas' | 'solido';
export type IntensidadeVidro = 'sutil' | 'medio' | 'forte';
export type TemaApp = 'claro' | 'escuro';
/** Tema de quem ainda não escolheu nenhum: o escuro é o padrão deste app. */
export const TEMA_PADRAO: TemaApp = 'escuro';
export const paraNextThemes = (t: TemaApp): 'light' | 'dark' => (t === 'escuro' ? 'dark' : 'light');
export const deNextThemes = (t: string): TemaApp => (t === 'dark' ? 'escuro' : 'claro');

export interface BackgroundPrefs {
  mode: ModoFundo;
  animate: boolean;
  /** 0.25×–3×, passo 0.25. */
  speed: number;
  /** Intensidade da cor de destaque no fundo, 0–1.5, passo 0.05. */
  goldIntensity: number;
  glassIntensity: IntensidadeVidro;
  /** 0–100, passo 5. 100 = vidro puro. */
  glassOpacity: number;
  reduceTransparency: boolean;
  reduceMotion: boolean;
  destaque: IdPaleta;
  tema?: TemaApp;
}

/** Padrão do app: Manchas, animado a 2×, destaque a 50%, Dourado, escuro. */
export const PREFS_PADRAO: BackgroundPrefs = {
  mode: 'manchas',
  animate: true,
  speed: 2,
  goldIntensity: 0.5,
  glassIntensity: 'sutil',
  glassOpacity: 100,
  reduceTransparency: false,
  reduceMotion: false,
  destaque: PALETA_PADRAO,
};

/**
 * Rotas públicas (sem paleta do usuário): ficam sempre no Dourado.
 * O portal do cliente (/cliente), a entrada (/entrar), os links dos e-mails
 * (/e) e a tela de instalação. A mesma lista vale para o script anti-piscada.
 */
export const ROTAS_PUBLICAS = ['/entrar', '/cliente', '/e', '/instalar', '/privacidade', '/demo'] as const;
export function ehRotaPublica(pathname: string): boolean {
  return pathname === '/' || ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export const CHAVE_LOCAL = 'pd.estetica';
export const CHAVE_TEMA_NAVEGADOR = 'theme';

export const BLUR_POR_INTENSIDADE: Record<IntensidadeVidro, number> = { sutil: 12, medio: 24, forte: 44 };
export const FOSCO_POR_INTENSIDADE: Record<IntensidadeVidro, { escuro: number; claro: number }> = {
  sutil: { escuro: 0, claro: 0 },
  medio: { escuro: 0.05, claro: 0.22 },
  forte: { escuro: 0.11, claro: 0.42 },
};

const MODOS: readonly ModoFundo[] = ['gradiente', 'manchas', 'solido'];
const INTENSIDADES: readonly IntensidadeVidro[] = ['sutil', 'medio', 'forte'];

const numero = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const trava = (v: number, min: number, max: number, step: number): number =>
  Number(Math.min(max, Math.max(min, Math.round(v / step) * step)).toFixed(4));

export function normalizarPrefs(entrada: unknown): BackgroundPrefs {
  const e = (entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {}) as Record<string, unknown>;
  return {
    mode: MODOS.includes(e.mode as ModoFundo) ? (e.mode as ModoFundo) : PREFS_PADRAO.mode,
    animate: e.animate !== false,
    speed: trava(numero(e.speed, PREFS_PADRAO.speed), 0.25, 3, 0.25),
    goldIntensity: trava(numero(e.goldIntensity, PREFS_PADRAO.goldIntensity), 0, 1.5, 0.05),
    glassIntensity: INTENSIDADES.includes(e.glassIntensity as IntensidadeVidro) ? (e.glassIntensity as IntensidadeVidro) : PREFS_PADRAO.glassIntensity,
    glassOpacity: trava(numero(e.glassOpacity, 100), 0, 100, 5),
    reduceTransparency: e.reduceTransparency === true,
    reduceMotion: e.reduceMotion === true,
    // Lista fechada: id desconhecido, "<script>" ou número viram o padrão.
    destaque: ehIdPaleta(e.destaque) ? e.destaque : PALETA_PADRAO,
    ...(e.tema === 'claro' || e.tema === 'escuro' ? { tema: e.tema } : {}),
  };
}

/** Aplica as preferências no <html>: variáveis, classes e o atributo data-destaque. */
export function aplicarPrefsNoDocumento(p: BackgroundPrefs, escuro: boolean, publica = false): void {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  if (publica || p.destaque === PALETA_PADRAO) raiz.removeAttribute('data-destaque');
  else raiz.setAttribute('data-destaque', p.destaque);
  raiz.style.setProperty('--bg-speed', String(p.speed));
  raiz.style.setProperty('--gi', String(p.goldIntensity));
  raiz.style.setProperty('--blur', p.reduceTransparency ? '0px' : `${BLUR_POR_INTENSIDADE[p.glassIntensity]}px`);
  const fosco = FOSCO_POR_INTENSIDADE[p.glassIntensity][escuro ? 'escuro' : 'claro'];
  raiz.style.setProperty('--glass-frost', `rgba(255, 255, 255, ${fosco})`);
  const k = Number((((100 - p.glassOpacity) / 100) * 0.92).toFixed(4));
  raiz.style.setProperty('--glass-veil', escuro ? `rgba(26, 24, 21, ${k})` : `rgba(247, 243, 234, ${k})`);
  raiz.classList.toggle('reduce-motion', p.reduceMotion);
  raiz.classList.toggle('reduce-transparency', p.reduceTransparency);
}

export function lerPrefsLocais(): BackgroundPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHAVE_LOCAL);
    return raw ? normalizarPrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function gravarPrefsLocais(p: BackgroundPrefs): void {
  try { window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(p)); } catch { /* sem armazenamento */ }
}
/** Ao sair da conta: apaga os caches deste navegador. */
export function esquecerPrefsLocais(): void {
  try {
    window.localStorage.removeItem(CHAVE_LOCAL);
    window.localStorage.removeItem(CHAVE_TEMA_NAVEGADOR);
  } catch { /* nada a apagar */ }
}
