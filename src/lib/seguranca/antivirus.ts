import { connect } from 'node:net';

/**
 * Antivírus (ClamAV) antes de o arquivo aparecer na pasta. Fala com o
 * clamd pelo protocolo INSTREAM (TCP), sem precisar do binário no app.
 * ANTIVIRUS=clamav liga; 'nenhum' só em desenvolvimento.
 */
export type ResultadoAntivirus = { limpo: true } | { limpo: false; ameaca: string };

export async function verificarAntivirus(dados: Buffer): Promise<ResultadoAntivirus> {
  const modo = process.env.ANTIVIRUS ?? 'nenhum';
  if (modo === 'nenhum') {
    if (process.env.NODE_ENV === 'production') throw new Error('ANTIVIRUS=nenhum não é permitido em produção');
    // Arquivo de teste EICAR é sempre recusado, para os testes do fluxo.
    if (dados.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))) return { limpo: false, ameaca: 'Eicar-Test-Signature' };
    return { limpo: true };
  }
  return clamdInstream(dados, process.env.CLAMD_HOST ?? '127.0.0.1', Number(process.env.CLAMD_PORT ?? 3310));
}

export function clamdInstream(dados: Buffer, host: string, port: number): Promise<ResultadoAntivirus> {
  return new Promise((ok, falha) => {
    const s = connect({ host, port });
    let resposta = '';
    s.setTimeout(60_000, () => { s.destroy(); falha(new Error('clamd não respondeu')); });
    s.on('error', falha);
    s.on('data', (d) => { resposta += d.toString(); });
    s.on('end', () => {
      const r = resposta.replace(/\0/g, '').trim();
      if (/OK$/.test(r)) ok({ limpo: true });
      else if (/FOUND$/.test(r)) ok({ limpo: false, ameaca: r.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '') });
      else falha(new Error(`clamd: ${r}`));
    });
    s.on('connect', () => {
      s.write('zINSTREAM\0');
      const PEDACO = 64 * 1024;
      for (let i = 0; i < dados.length; i += PEDACO) {
        const parte = dados.subarray(i, i + PEDACO);
        const tam = Buffer.alloc(4); tam.writeUInt32BE(parte.length);
        s.write(tam); s.write(parte);
      }
      s.end(Buffer.alloc(4));
    });
  });
}
