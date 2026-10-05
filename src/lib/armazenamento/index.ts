import { mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve, normalize, sep } from 'node:path';
import { assinar } from '@/lib/assinatura';

/**
 * Armazenamento dos arquivos, numa interface só:
 * - s3: bucket compatível com S3 em São Paulo (sa-east-1), privado, com
 *   criptografia no servidor e URLs assinadas de curta duração (produção);
 * - local: pasta ./armazenamento, com URLs assinadas pelo próprio app (desenvolvimento);
 * - memoria: para os testes.
 * Nenhum arquivo é público: leitura e envio só por URL assinada.
 */
export interface OpcoesLeitura { segundos?: number; nomeArquivo?: string; inline?: boolean; mime?: string }
export interface Armazenamento {
  salvar(chave: string, dados: Buffer, mime: string): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  existe(chave: string): Promise<boolean>;
  apagar(chave: string): Promise<void>;
  urlLeitura(chave: string, o?: OpcoesLeitura): Promise<string>;
  urlEnvio(chave: string, o: { segundos?: number; mime: string }): Promise<{ url: string; metodo: 'PUT'; cabecalhos: Record<string, string> }>;
}

const LEITURA_PADRAO = 120;   // 2 minutos
const ENVIO_PADRAO = 600;     // 10 minutos

function disposicao(o: OpcoesLeitura): string {
  const nome = (o.nomeArquivo ?? 'arquivo').replace(/[^\w.\-]/g, '_');
  return `${o.inline ? 'inline' : 'attachment'}; filename="${nome}"`;
}

/** Local e memória: a URL aponta para /arquivo/<token assinado>, servida pelo app. */
function urlsDoApp(): Pick<Armazenamento, 'urlLeitura' | 'urlEnvio'> {
  return {
    async urlLeitura(chave, o = {}) {
      const t = assinar({ op: 'r', c: chave, d: disposicao(o), m: o.mime ?? 'application/octet-stream' }, o.segundos ?? LEITURA_PADRAO);
      return `/arquivo/${t}`;
    },
    async urlEnvio(chave, o) {
      const t = assinar({ op: 'w', c: chave, m: o.mime }, o.segundos ?? ENVIO_PADRAO);
      return { url: `/arquivo/${t}`, metodo: 'PUT', cabecalhos: { 'content-type': o.mime } };
    },
  };
}

function local(): Armazenamento {
  const base = resolve(process.cwd(), process.env.ARMAZENAMENTO_PASTA ?? 'armazenamento');
  const caminho = (chave: string) => {
    const p = normalize(resolve(base, chave));
    if (!p.startsWith(base + sep)) throw new Error('Chave inválida');
    return p;
  };
  return {
    async salvar(chave, dados) { const p = caminho(chave); await mkdir(dirname(p), { recursive: true }); await writeFile(p, dados); },
    async ler(chave) { return readFile(caminho(chave)); },
    async existe(chave) { try { await stat(caminho(chave)); return true; } catch { return false; } },
    async apagar(chave) { await rm(caminho(chave), { force: true }); },
    ...urlsDoApp(),
  };
}

const memoriaGlobal = globalThis as unknown as { __pdMem?: Map<string, Buffer> };
function memoria(): Armazenamento {
  const m = (memoriaGlobal.__pdMem ??= new Map());
  return {
    async salvar(chave, dados) { m.set(chave, Buffer.from(dados)); },
    async ler(chave) { const d = m.get(chave); if (!d) throw new Error(`Não existe: ${chave}`); return d; },
    async existe(chave) { return m.has(chave); },
    async apagar(chave) { m.delete(chave); },
    ...urlsDoApp(),
  };
}

function s3(): Armazenamento {
  const bucket = process.env.S3_BUCKET!;
  const cliente = async () => {
    const { S3Client } = await import('@aws-sdk/client-s3');
    return new S3Client({
      region: process.env.S3_REGION || 'sa-east-1',
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      ...(process.env.S3_ACCESS_KEY_ID ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' } } : {}),
    });
  };
  return {
    async salvar(chave, dados, mime) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await (await cliente()).send(new PutObjectCommand({ Bucket: bucket, Key: chave, Body: dados, ContentType: mime, ServerSideEncryption: 'AES256' }));
    },
    async ler(chave) {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const r = await (await cliente()).send(new GetObjectCommand({ Bucket: bucket, Key: chave }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async existe(chave) {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      try { await (await cliente()).send(new HeadObjectCommand({ Bucket: bucket, Key: chave })); return true; } catch { return false; }
    },
    async apagar(chave) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      await (await cliente()).send(new DeleteObjectCommand({ Bucket: bucket, Key: chave }));
    },
    async urlLeitura(chave, o = {}) {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      return getSignedUrl(await cliente(), new GetObjectCommand({ Bucket: bucket, Key: chave, ResponseContentDisposition: disposicao(o), ...(o.mime ? { ResponseContentType: o.mime } : {}) }), { expiresIn: o.segundos ?? LEITURA_PADRAO });
    },
    async urlEnvio(chave, o) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const url = await getSignedUrl(await cliente(), new PutObjectCommand({ Bucket: bucket, Key: chave, ContentType: o.mime, ServerSideEncryption: 'AES256' }), { expiresIn: o.segundos ?? ENVIO_PADRAO });
      return { url, metodo: 'PUT', cabecalhos: { 'content-type': o.mime, 'x-amz-server-side-encryption': 'AES256' } };
    },
  };
}

export function armazenamento(): Armazenamento {
  const modo = process.env.ARMAZENAMENTO ?? 'local';
  if (modo === 's3') return s3();
  if (modo === 'memoria') return memoria();
  return local();
}
