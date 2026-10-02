/**
 * Qualidade da foto, antes de enviar (sem OpenCV, para funcionar sempre):
 * - tremida: pouca variação do Laplaciano (bordas sem nitidez);
 * - escura: brilho médio baixo;
 * - cortada: não achou as 4 bordas do papel, ou elas encostam na borda da foto.
 */
export interface Imagem { data: Uint8ClampedArray | Uint8Array; width: number; height: number }
export interface Qualidade { tremida: boolean; escura: boolean; cortada: boolean; nitidez: number; brilho: number }
export type Ponto = { x: number; y: number };

export const LIMITES = { nitidez: 45, brilho: 70, margem: 0.012 };

export function avaliarQualidade(img: Imagem, quad: Ponto[] | null): Qualidade {
  const { width: w, height: h, data } = img;
  const cinza = new Float32Array(w * h);
  let soma = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    cinza[p] = v; soma += v;
  }
  const brilho = soma / (w * h);
  // Variância do Laplaciano (núcleo 4-vizinhos), ignorando a borda de 1 px.
  let n = 0, media = 0, m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = cinza[i - 1] + cinza[i + 1] + cinza[i - w] + cinza[i + w] - 4 * cinza[i];
      n++; const d = l - media; media += d / n; m2 += d * (l - media);
    }
  }
  const nitidez = n > 1 ? m2 / (n - 1) : 0;
  const mx = w * LIMITES.margem, my = h * LIMITES.margem;
  const cortada = !quad || quad.some((p) => p.x <= mx || p.y <= my || p.x >= w - mx || p.y >= h - my);
  return { tremida: nitidez < LIMITES.nitidez, escura: brilho < LIMITES.brilho, cortada, nitidez, brilho };
}

export function avisosDe(q: Qualidade): string[] {
  return [q.tremida && 'tremida', q.escura && 'escura', q.cortada && 'cortada'].filter(Boolean) as string[];
}

/** Ordena 4 pontos: superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo. */
export function ordenarCantos(p: Ponto[]): Ponto[] {
  const s = [...p].sort((a, b) => a.x + a.y - (b.x + b.y));
  const tl = s[0], br = s[3];
  const resto = [s[1], s[2]].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [tl, resto[0], br, resto[1]];
}
