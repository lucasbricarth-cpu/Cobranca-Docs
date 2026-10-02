import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:net';
import { clamdInstream } from '@/lib/seguranca/antivirus';
import { iniciarClamdFalso } from '../scripts/clamd-falso.mjs';

let srv: Server;
beforeAll(async () => { srv = await iniciarClamdFalso(3399); });
afterAll(() => srv.close());

describe('antivírus (protocolo INSTREAM do clamd)', () => {
  it('arquivo limpo passa; EICAR é acusado', async () => {
    expect(await clamdInstream(Buffer.from('um pdf qualquer'), '127.0.0.1', 3399)).toEqual({ limpo: true });
    const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    expect(await clamdInstream(eicar, '127.0.0.1', 3399)).toEqual({ limpo: false, ameaca: 'Eicar-Test-Signature' });
  });
  it('arquivo grande vai em pedaços', async () => {
    expect(await clamdInstream(Buffer.alloc(300 * 1024, 7), '127.0.0.1', 3399)).toEqual({ limpo: true });
  });
});
