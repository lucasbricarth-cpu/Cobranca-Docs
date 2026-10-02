/**
 * Leitor local da Domínio — roda no servidor do escritório (agendado, no
 * mínimo uma vez por dia). Lê só com SELECT e envia ao app por HTTPS, de
 * dentro para fora. O app na nuvem nunca se conecta ao banco da Domínio.
 *
 *   npm run sincronizar            # lê e envia
 *   npm run diagnostico            # inclui o diagnóstico inicial (uma vez)
 *   npm run testar-conexao         # só confere a conexão e a contagem de empresas
 */
import { existsSync, readFileSync } from 'node:fs';
import { abrirConexao } from './conexao.ts';
import { lerDominio } from './ler.ts';

function carregarEnv() {
  if (!existsSync('.env')) return;
  for (const l of readFileSync('.env', 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || l.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    process.env[m[1]] ??= v;
  }
}

carregarEnv();
const args = process.argv.slice(2);
const conexao = await abrirConexao();
try {
  const lote = await lerDominio(conexao, { diagnostico: args.includes('--diagnostico'), sqlEncerradas: process.env.DOMINIO_SQL_ENCERRADAS || undefined });
  console.log(`Lidos: ${lote.empresas.length} empresas, ${lote.contatos.length} contatos, ${lote.responsaveis.length} responsáveis, ${lote.contas.length} contas.`);
  if (args.includes('--testar')) process.exit(0);
  const r = await fetch(`${process.env.APP_URL}/api/leitor/sincronizar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.LEITOR_DOMINIO_TOKEN}` },
    body: JSON.stringify(lote),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`O app recusou o envio (${r.status}): ${j.erro ?? ''}`);
  console.log('Enviado:', JSON.stringify(j.resumo));
} finally {
  await conexao.fechar();
}
