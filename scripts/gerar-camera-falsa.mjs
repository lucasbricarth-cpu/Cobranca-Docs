// Gera um vídeo y4m (um quadro) com um documento sobre a mesa, para a câmera
// falsa do Chromium nas capturas: --use-file-for-fake-video-capture=<arquivo>.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const W = 1280, H = 720;
const linhas = Array.from({ length: 13 }).map((_, i) => `<rect x="70" y="${170 + i * 34}" width="${220 + ((i * 53) % 120)}" height="11" fill="#9a9a9a"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b4632"/><stop offset="1" stop-color="#3a2c20"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#m)"/>
  <g transform="translate(420 70) rotate(-6 220 290)">
    <rect x="0" y="0" width="440" height="580" fill="#f6f3ec"/>
    <rect x="0" y="0" width="440" height="70" fill="#ec5c0d"/>
    <text x="30" y="46" font-family="sans-serif" font-size="28" font-weight="700" fill="#fff">Itaú · Extrato</text>
    <text x="30" y="120" font-family="sans-serif" font-size="15" fill="#333">Agência 0912  Conta 45567-0</text>
    <text x="30" y="145" font-family="sans-serif" font-size="15" fill="#333">CNPJ 11.222.333/0001-81</text>
    ${linhas}
  </g></svg>`;
const { data } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const Y = Buffer.alloc(W * H), U = Buffer.alloc((W / 2) * (H / 2)), V = Buffer.alloc((W / 2) * (H / 2));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
  Y[y * W + x] = Math.max(0, Math.min(255, 0.299 * r + 0.587 * g + 0.114 * b));
  if (y % 2 === 0 && x % 2 === 0) {
    const j = (y / 2) * (W / 2) + x / 2;
    U[j] = Math.max(0, Math.min(255, 128 - 0.168736 * r - 0.331264 * g + 0.5 * b));
    V[j] = Math.max(0, Math.min(255, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b));
  }
}
const destino = process.argv[2] ?? 'capturas/camera.y4m';
writeFileSync(destino, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\nFRAME\n`), Y, U, V]));
console.log(destino);
