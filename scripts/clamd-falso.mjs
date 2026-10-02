// clamd FALSO, só para desenvolvimento, capturas e testes: fala o protocolo INSTREAM
// do ClamAV e acusa o arquivo de teste EICAR. Nunca use em produção.
//   node scripts/clamd-falso.mjs [porta]
import { createServer } from 'node:net';

export function iniciarClamdFalso(porta = 3311) {
  const srv = createServer((s) => {
    let buf = Buffer.alloc(0);
    let comando = false;
    const partes = [];
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (!comando) {
        const fim = buf.indexOf(0);
        if (fim < 0) return;
        comando = true;
        buf = buf.subarray(fim + 1);
      }
      while (buf.length >= 4) {
        const n = buf.readUInt32BE(0);
        if (n === 0) {
          const tudo = Buffer.concat(partes);
          s.end(tudo.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
          return;
        }
        if (buf.length < 4 + n) return;
        partes.push(buf.subarray(4, 4 + n));
        buf = buf.subarray(4 + n);
      }
    });
    s.on('error', () => undefined);
  });
  return new Promise((ok) => srv.listen(porta, '127.0.0.1', () => ok(srv)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const porta = Number(process.argv[2] ?? 3311);
  await iniciarClamdFalso(porta);
  console.log(`clamd falso em 127.0.0.1:${porta}`);
}
