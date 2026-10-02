// Copia o OpenCV.js do pacote npm para /public/opencv, de onde o scanner da
// câmera o carrega sob demanda (só quando o cliente abre a câmera).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
const origem = 'node_modules/@techstark/opencv-js/dist/opencv.js';
if (existsSync(origem)) {
  mkdirSync('public/opencv', { recursive: true });
  copyFileSync(origem, 'public/opencv/opencv.js');
  console.log('opencv.js copiado para public/opencv/');
} else {
  console.warn('opencv.js não encontrado; o scanner vai usar o modo simples.');
}
