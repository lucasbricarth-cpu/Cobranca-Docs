// Copia para /public as bibliotecas que o navegador carrega sob demanda:
// - OpenCV.js (scanner da câmera, só quando o cliente abre a câmera);
// - pdf.js (visualizador de PDF em qualquer aparelho, inclusive iPhone).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
const copias = [
  ['node_modules/@techstark/opencv-js/dist/opencv.js', 'public/opencv/opencv.js'],
  ['node_modules/pdfjs-dist/legacy/build/pdf.min.mjs', 'public/pdfjs/pdf.min.mjs'],
  ['node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'public/pdfjs/pdf.worker.min.mjs'],
];
for (const [de, para] of copias) {
  if (!existsSync(de)) { console.warn(`não encontrado: ${de}`); continue; }
  mkdirSync(para.slice(0, para.lastIndexOf('/')), { recursive: true });
  copyFileSync(de, para);
  console.log(`copiado: ${para}`);
}
