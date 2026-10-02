import { z } from 'zod';
import { todos } from '@/lib/db';

export const DadosTipo = z.object({
  nome: z.string().min(2).max(80),
  subtipo_origem: z.enum(['contas', 'cartoes', 'livre']).nullable(),
  regra_mes: z.enum(['anterior', 'atual']),
  sensivel: z.boolean(),
  guarda_meses: z.number().int().min(1).max(1200),
  icone: z.string().max(40).default('file-text'),
  ativo: z.boolean().default(true),
  arquivamento_automatico: z.boolean().optional(),
});

export interface Tipo { id: string; nome: string; subtipo_origem: 'contas' | 'cartoes' | 'livre' | null; regra_mes: 'anterior' | 'atual'; sensivel: boolean; guarda_meses: number; icone: string; ordem: number; ativo: boolean; arquivamento_automatico: boolean }

export async function listarTipos(soAtivos = false): Promise<Tipo[]> {
  return todos<Tipo>(`SELECT id, nome, subtipo_origem, regra_mes, sensivel, guarda_meses, icone, ordem, ativo, arquivamento_automatico FROM tipos_documento ${soAtivos ? 'WHERE ativo' : ''} ORDER BY ordem, nome`);
}
