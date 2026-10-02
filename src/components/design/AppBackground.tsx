'use client';

import { useBackgroundPrefs } from './BackgroundPrefsProvider';

/**
 * Fundo animado do Glass Dourado, renderizado UMA vez no layout raiz, atrás
 * de tudo (z-index:-1; ver .app-bg em globals.css). Três modos: Gradiente,
 * Manchas (padrão) e Sólido. As cores vêm dos tokens, então claro/escuro e a
 * paleta trocam sozinhos; velocidade e intensidade chegam por --bg-speed e
 * --gi, que o provider põe no <html>. Em telas estreitas o CSS aplica a
 * variante do celular (ângulo mais vertical). `preview` monta o mesmo fundo
 * dentro de um cartão, para a miniatura de Ajustes › Estética.
 */
export default function AppBackground({ preview = false }: { preview?: boolean }) {
  const { prefs } = useBackgroundPrefs();
  const modo = prefs.mode;
  return (
    <div
      className={['app-bg', preview ? 'app-bg-preview' : ''].filter(Boolean).join(' ')}
      data-mode={modo}
      data-animate={prefs.animate ? 'true' : 'false'}
      aria-hidden="true"
    >
      {modo === 'gradiente' && (<><div className="bg-grad" /><div className="bg-glow" /></>)}
      {modo === 'manchas' && (<><div className="bg-orb bg-orb-a" /><div className="bg-orb bg-orb-b" /><div className="bg-orb bg-orb-c" /></>)}
    </div>
  );
}
