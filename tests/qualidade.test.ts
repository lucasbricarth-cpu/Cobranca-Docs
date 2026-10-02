import { describe, expect, it } from 'vitest';
import { avaliarQualidade, ordenarCantos } from '@/components/envio/qualidade';

function imagem(w: number, h: number, pixel: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = pixel(x, y), i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}
const quadDentro = [{ x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 130 }, { x: 20, y: 130 }];

describe('qualidade da foto antes de enviar', () => {
  it('foto nítida, clara e com o papel inteiro passa', () => {
    const nitida = imagem(200, 150, (x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 230 : 90));
    expect(avaliarQualidade(nitida, quadDentro)).toMatchObject({ tremida: false, escura: false, cortada: false });
  });
  it('tremida: sem bordas definidas', () => {
    const borrada = imagem(200, 150, (x) => 120 + Math.round(60 * Math.sin(x / 40)));
    expect(avaliarQualidade(borrada, quadDentro).tremida).toBe(true);
  });
  it('escura: brilho médio baixo', () => {
    const escura = imagem(200, 150, (x, y) => ((x + y) % 2 ? 40 : 10));
    expect(avaliarQualidade(escura, quadDentro).escura).toBe(true);
  });
  it('cortada: sem as 4 bordas, ou encostando na borda da foto', () => {
    const ok = imagem(200, 150, (x, y) => ((x + y) % 3 ? 220 : 80));
    expect(avaliarQualidade(ok, null).cortada).toBe(true);
    expect(avaliarQualidade(ok, [{ x: 0, y: 10 }, ...quadDentro.slice(1)]).cortada).toBe(true);
  });
  it('ordena os cantos do papel', () => {
    expect(ordenarCantos([{ x: 180, y: 130 }, { x: 20, y: 20 }, { x: 20, y: 130 }, { x: 180, y: 20 }])).toEqual(quadDentro);
  });
});
