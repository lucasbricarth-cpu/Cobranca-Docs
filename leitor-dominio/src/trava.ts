/**
 * Trava de somente leitura do leitor da Domínio.
 *
 * Camada 1 (esta): toda consulta passa por `conferirConsulta`, que só aceita
 * um SELECT único, sem palavras de escrita, e só nas tabelas da lista.
 * Camada 2 (no banco): o usuário do leitor só tem GRANT SELECT nessas
 * tabelas (sql/criar-usuario-leitura.sql). Uma escrita falha nas duas.
 */
export const TABELAS_PERMITIDAS = [
  'geempre',
  'geempre_contato',
  'pcresponsavel_empresa',
  'ctcontacaixa_conta_bancaria',
  'ctlista_bancos_banco_central',
  'ctcontas',
  // Só para o diagnóstico inicial (contagens), uma vez:
  'geempresas_moduloweb',
  'geatendimento_publicar_documentos',
  'pcvinculo_processo',
] as const;

const PROIBIDAS = /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|exec|execute|call|into|commit|rollback|set|lock|replace|load|unload|input|output)\b/i;

export class EscritaRecusada extends Error {}

export function conferirConsulta(sql: string): void {
  const s = sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
  if (!/^select\b/i.test(s)) throw new EscritaRecusada('Só SELECT é permitido no leitor da Domínio.');
  if (s.includes(';')) throw new EscritaRecusada('Uma consulta por vez (sem ";").');
  if (PROIBIDAS.test(s)) throw new EscritaRecusada('Palavra de escrita encontrada na consulta.');
  const tabelas = [...s.matchAll(/\b(?:from|join)\s+([a-z0-9_."]+)/gi)].map((m) => m[1].replace(/"/g, '').split('.').pop()!.toLowerCase());
  if (tabelas.length === 0) throw new EscritaRecusada('Consulta sem tabela.');
  for (const t of tabelas) {
    if (!(TABELAS_PERMITIDAS as readonly string[]).includes(t)) throw new EscritaRecusada(`Tabela fora da lista do leitor: ${t}`);
  }
}
