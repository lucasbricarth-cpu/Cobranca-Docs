import { q, todos, um } from '@/lib/db';

/**
 * Fila de trabalho no próprio Postgres (FOR UPDATE SKIP LOCKED): antivírus,
 * miniatura, classificação, avisos, WhatsApp. Uma chave única evita a mesma
 * tarefa duas vezes. Quem roda: o worker (`npm run job:fila`) e, para não
 * esperar, um disparo no próprio processo logo depois de enfileirar.
 */
export type Tarefa = { id: number; tipo: string; dados: Record<string, unknown>; tentativas: number };
type Manipulador = (dados: Record<string, unknown>) => Promise<void>;

const manipuladores = new Map<string, Manipulador>();
export function registrarTarefa(tipo: string, fn: Manipulador) { manipuladores.set(tipo, fn); }

export async function enfileirar(tipo: string, dados: Record<string, unknown>, o: { chave?: string; executarEm?: Date } = {}): Promise<boolean> {
  const r = await q(
    `INSERT INTO fila (tipo, dados, chave, executar_em) VALUES ($1, $2, $3, coalesce($4, now())) ON CONFLICT (chave) DO NOTHING`,
    [tipo, JSON.stringify(dados), o.chave ?? null, o.executarEm ?? null]);
  return (r.rowCount ?? 0) > 0;
}

/** Remarca uma tarefa pendente (ex.: o agrupamento de 30 s do WhatsApp). */
export async function reagendar(chave: string, executarEm: Date): Promise<void> {
  await q(`UPDATE fila SET executar_em = $2 WHERE chave = $1 AND status = 'pendente'`, [chave, executarEm]);
}

const MAX_TENTATIVAS = 5;

/** Roda até `limite` tarefas vencidas. Devolve quantas rodou. */
export async function rodarFila(limite = 20, tipos?: string[]): Promise<number> {
  await carregarManipuladores();
  let n = 0;
  for (; n < limite; n++) {
    const t = await um<Tarefa>(
      `UPDATE fila SET status = 'rodando', tentativas = tentativas + 1
       WHERE id = (SELECT id FROM fila WHERE status = 'pendente' AND executar_em <= now() AND ($1::text[] IS NULL OR tipo = ANY($1))
                   ORDER BY executar_em, id FOR UPDATE SKIP LOCKED LIMIT 1)
       RETURNING id, tipo, dados, tentativas`, [tipos ?? null]);
    if (!t) break;
    const fn = manipuladores.get(t.tipo);
    try {
      if (!fn) throw new Error(`Sem manipulador para ${t.tipo}`);
      await fn(t.dados);
      await q(`UPDATE fila SET status = 'feito', feito_em = now(), erro = NULL WHERE id = $1`, [t.id]);
    } catch (e) {
      const msg = (e as Error).message?.slice(0, 500) ?? 'erro';
      const desistir = t.tentativas >= MAX_TENTATIVAS;
      await q(`UPDATE fila SET status = $2, erro = $3, executar_em = now() + ($4 || ' seconds')::interval WHERE id = $1`,
        [t.id, desistir ? 'falhou' : 'pendente', msg, String(30 * 2 ** t.tentativas)]);
    }
  }
  return n;
}

/** Disparo no próprio processo, sem esperar (o worker cobre o que sobrar). */
export function dispararFila(): void {
  if (process.env.VITEST) return;
  setTimeout(() => { rodarFila().catch((e) => console.error('[fila]', e)); }, 10);
}

export async function pendentesNaFila(): Promise<{ tipo: string; n: number }[]> {
  return todos(`SELECT tipo, count(*)::int AS n FROM fila WHERE status = 'pendente' GROUP BY tipo`);
}

let carregado = false;
async function carregarManipuladores() {
  if (carregado) return;
  carregado = true;
  // Cada módulo registra as próprias tarefas ao ser importado.
  await import('@/lib/documentos/processar');
  await import('@/lib/tarefas');
}
