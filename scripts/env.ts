import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Carrega o .env (sem dependência): só preenche o que ainda não está no ambiente. */
export function carregarEnv(arquivo = '.env'): void {
  const p = resolve(process.cwd(), arquivo);
  if (!existsSync(p)) return;
  for (const linha of readFileSync(p, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || linha.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
