'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  aplicarPrefsNoDocumento, deNextThemes, ehRotaPublica, esquecerPrefsLocais, gravarPrefsLocais,
  lerPrefsLocais, normalizarPrefs, paraNextThemes, PREFS_PADRAO, TEMA_PADRAO,
  type BackgroundPrefs, type TemaApp,
} from '@/lib/backgroundPrefs';

/**
 * Guarda as preferências de estética DO USUÁRIO e as aplica no <html>.
 * Ordem: (1) cache local, para não piscar; (2) servidor, a fonte da verdade,
 * consultado ao montar numa rota privada e a cada entrada numa (o login
 * navega sem recarregar). Em rota pública não há paleta e nem se pergunta.
 * Adaptado do handoff (BackgroundPrefsProvider.tsx).
 */
interface ContextoPrefs {
  prefs: BackgroundPrefs;
  sincronizado: boolean;
  salvando: boolean;
  alterar: (patch: Partial<BackgroundPrefs>) => void;
  restaurar: () => void;
  alternarTema: () => void;
  esquecer: () => void;
}

const Contexto = createContext<ContextoPrefs | null>(null);

export function BackgroundPrefsProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname() || '';
  const publica = ehRotaPublica(pathname);
  const [prefs, setPrefs] = useState<BackgroundPrefs>(PREFS_PADRAO);
  const [sincronizado, setSincronizado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versao = useRef(0);
  const temaNavegador = useRef(resolvedTheme);
  temaNavegador.current = resolvedTheme;

  const persistir = useCallback((p: BackgroundPrefs) => {
    gravarPrefsLocais(p);
    if (temporizador.current) clearTimeout(temporizador.current);
    const minha = ++versao.current;
    temporizador.current = setTimeout(async () => {
      setSalvando(true);
      try {
        await fetch('/api/preferencias/estetica', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prefs: p }),
        });
      } catch { /* fica no cache */ } finally {
        if (versao.current === minha) setSalvando(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    const local = lerPrefsLocais();
    if (local) setPrefs(local);
  }, []);

  useEffect(() => {
    if (publica) return;
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch('/api/preferencias/estetica', { cache: 'no-store' });
        if (!r.ok || cancelado) return;
        const j = await r.json();
        if (cancelado || !j?.ok) return;
        let doServidor = normalizarPrefs(j.prefs);
        if (!doServidor.tema) {
          const atual = temaNavegador.current;
          doServidor = { ...doServidor, tema: atual === 'dark' || atual === 'light' ? deNextThemes(atual) : TEMA_PADRAO };
          persistir(doServidor);
        }
        setPrefs(doServidor);
        gravarPrefsLocais(doServidor);
        setSincronizado(true);
      } catch { /* offline: continua no cache */ }
    })();
    return () => { cancelado = true; };
  }, [publica, persistir]);

  useEffect(() => {
    if (prefs.tema && !publica) setTheme(paraNextThemes(prefs.tema));
  }, [prefs.tema, publica, setTheme]);

  const primeiraAplicacao = useRef(true);
  useEffect(() => {
    const efetivas = primeiraAplicacao.current ? lerPrefsLocais() ?? prefs : prefs;
    primeiraAplicacao.current = false;
    aplicarPrefsNoDocumento(efetivas, resolvedTheme === 'dark', ehRotaPublica(pathname));
  }, [prefs, resolvedTheme, pathname]);

  const alterar = useCallback((patch: Partial<BackgroundPrefs>) => {
    setPrefs((atual) => {
      const proximo = normalizarPrefs({ ...atual, ...patch });
      persistir(proximo);
      return proximo;
    });
  }, [persistir]);

  const restaurar = useCallback(() => {
    const proximo = normalizarPrefs({ ...PREFS_PADRAO, tema: TEMA_PADRAO });
    setPrefs(proximo);
    persistir(proximo);
  }, [persistir]);

  const alternarTema = useCallback(() => {
    const proximo: TemaApp = temaNavegador.current === 'dark' ? 'claro' : 'escuro';
    alterar({ tema: proximo });
  }, [alterar]);

  const esquecer = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    versao.current += 1;
    setSalvando(false);
    setSincronizado(false);
    setPrefs(PREFS_PADRAO);
    esquecerPrefsLocais();
    setTheme(paraNextThemes(TEMA_PADRAO));
  }, [setTheme]);

  return (
    <Contexto.Provider value={{ prefs, sincronizado, salvando, alterar, restaurar, alternarTema, esquecer }}>
      {children}
    </Contexto.Provider>
  );
}

const FORA_DO_PROVIDER: ContextoPrefs = {
  prefs: PREFS_PADRAO, sincronizado: false, salvando: false,
  alterar: () => undefined, restaurar: () => undefined, alternarTema: () => undefined, esquecer: () => undefined,
};
export function useBackgroundPrefs(): ContextoPrefs {
  return useContext(Contexto) ?? FORA_DO_PROVIDER;
}
