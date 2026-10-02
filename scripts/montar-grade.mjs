// Junta capturas numa grade (para revisão): node scripts/montar-grade.mjs saida.png colunas largura altura arq1 arq2 ...
import sharp from 'sharp';
const [saida, colunas, w, h, ...arquivos] = process.argv.slice(2);
const C = Number(colunas), W = Number(w), H = Number(h);
const linhas = Math.ceil(arquivos.length / C);
const peças = await Promise.all(arquivos.map((a) => sharp(a).resize(W, H, { fit: 'cover', position: 'top' }).toBuffer()));
await sharp({ create: { width: C * W, height: linhas * H, channels: 3, background: '#000' } })
  .composite(peças.map((input, i) => ({ input, left: (i % C) * W, top: Math.floor(i / C) * H })))
  .png().toFile(saida);
console.log(saida);
