'use client';

import { Check, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import AppBackground from './AppBackground';
import { useBackgroundPrefs } from './BackgroundPrefsProvider';
import { IDS_PALETA, PALETAS } from '@/lib/paletas';
import type { IntensidadeVidro, ModoFundo } from '@/lib/backgroundPrefs';

/**
 * Ajustes › Estética (handoff §9, adaptado): cor de destaque (6 paletas),
 * fundo, animação, velocidade, intensidade, vidro, tema e prévia ao vivo.
 */
export function Estetica() {
  const { prefs, alterar, restaurar, salvando, alternarTema } = useBackgroundPrefs();
  const { resolvedTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const escuro = montado ? resolvedTheme === 'dark' : true;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] max-w-[980px]">
      <div className="flex flex-col gap-4">
        <section className="card p-4">
          <div className="eyebrow mb-3">Cor de destaque</div>
          <div className="paletas" role="radiogroup" aria-label="Cor de destaque">
            {IDS_PALETA.map((id) => {
              const p = PALETAS[id];
              const t = escuro ? p.escuro : p.claro;
              const on = prefs.destaque === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={on} className={`paleta-opcao ${on ? 'is-on' : ''}`} onClick={() => alterar({ destaque: id })}>
                  <span className="paleta-amostra" style={{ background: `linear-gradient(90deg, ${t.cta[0]}, ${t.cta[1]})`, color: t.sobre }}>
                    {on && <Check aria-hidden />}
                  </span>
                  {p.nome}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card p-4">
          <div className="eyebrow mb-3">Tema</div>
          <div className="seg">
            <button type="button" className={`seg-item ${!escuro ? 'active' : ''}`} onClick={() => !escuro || alternarTema()}><Sun size={13} aria-hidden />Claro</button>
            <button type="button" className={`seg-item ${escuro ? 'active' : ''}`} onClick={() => escuro || alternarTema()}><Moon size={13} aria-hidden />Escuro</button>
          </div>
        </section>

        <section className="card p-4 flex flex-col gap-4">
          <div>
            <div className="eyebrow mb-3">Fundo</div>
            <div className="seg">
              {(['manchas', 'gradiente', 'solido'] as ModoFundo[]).map((m) => (
                <button key={m} type="button" className={`seg-item ${prefs.mode === m ? 'active' : ''}`} onClick={() => alterar({ mode: m })}>
                  {m === 'manchas' ? 'Manchas' : m === 'gradiente' ? 'Gradiente' : 'Sólido'}
                </button>
              ))}
            </div>
          </div>
          {prefs.mode !== 'solido' && (
            <>
              <label className="flex items-center justify-between gap-3 text-[13px]">
                Animar fundo
                <input type="checkbox" className="sw" checked={prefs.animate} onChange={(e) => alterar({ animate: e.target.checked })} />
              </label>
              <label className="block text-[13px]">
                <span className="flex justify-between"><span>Velocidade</span><span className="mono text-fg-3">{prefs.speed}×</span></span>
                <input type="range" className="gd-range" min={0.25} max={3} step={0.25} value={prefs.speed} onChange={(e) => alterar({ speed: Number(e.target.value) })} disabled={!prefs.animate} />
              </label>
              <label className="block text-[13px]">
                <span className="flex justify-between"><span>Intensidade da cor de destaque</span><span className="mono text-fg-3">{Math.round(prefs.goldIntensity * 100)}%</span></span>
                <input type="range" className="gd-range" min={0} max={1.5} step={0.05} value={prefs.goldIntensity} onChange={(e) => alterar({ goldIntensity: Number(e.target.value) })} />
              </label>
            </>
          )}
        </section>

        <section className="card p-4 flex flex-col gap-4">
          <div>
            <div className="eyebrow mb-3">Vidro</div>
            <div className="seg">
              {(['sutil', 'medio', 'forte'] as IntensidadeVidro[]).map((v) => (
                <button key={v} type="button" className={`seg-item ${prefs.glassIntensity === v ? 'active' : ''}`} onClick={() => alterar({ glassIntensity: v })}>
                  {v === 'sutil' ? 'Sutil' : v === 'medio' ? 'Médio' : 'Forte'}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-[13px]">
            <span className="flex justify-between"><span>Transparência</span><span className="mono text-fg-3">{prefs.glassOpacity}</span></span>
            <input type="range" className="gd-range" min={0} max={100} step={5} value={prefs.glassOpacity} onChange={(e) => alterar({ glassOpacity: Number(e.target.value) })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px]">Reduzir transparência<input type="checkbox" className="sw" checked={prefs.reduceTransparency} onChange={(e) => alterar({ reduceTransparency: e.target.checked })} /></label>
          <label className="flex items-center justify-between gap-3 text-[13px]">Reduzir animações<input type="checkbox" className="sw" checked={prefs.reduceMotion} onChange={(e) => alterar({ reduceMotion: e.target.checked })} /></label>
        </section>

        <div className="flex items-center gap-3">
          <button type="button" className="btn" onClick={restaurar}>Restaurar padrão</button>
          <span className="text-[12px] text-fg-4" aria-live="polite">{salvando ? 'Salvando…' : ''}</span>
        </div>
      </div>

      <aside className="lg:sticky lg:top-0 self-start">
        <div className="eyebrow mb-2">Prévia</div>
        <div className="card relative overflow-hidden" style={{ aspectRatio: '16 / 10' }}>
          <AppBackground preview />
          <div className="absolute inset-4 glass-panel p-3 flex flex-col gap-2" style={{ borderRadius: 16 }}>
            <div className="h3">Extrato Itaú 567 · Set/2026</div>
            <div className="flex gap-2"><span className="pill st-conferido">Conferido</span><span className="pill st-recebido">Recebido · a conferir</span></div>
            <div className="barra mt-auto"><i className="b-conferidos" style={{ width: '62%' }} /></div>
            <button type="button" className="btn btn-primary btn-sm self-start">Pedir documento</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
