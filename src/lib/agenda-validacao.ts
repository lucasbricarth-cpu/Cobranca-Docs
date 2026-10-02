import { z } from 'zod';
export const DadosModelo = z.object({
  perfil: z.enum(['simples', 'presumido', 'mei', 'folha']),
  tipo_id: z.string().uuid(),
  dia_criacao: z.number().int().min(1).max(31),
  dia_prazo: z.number().int().min(1).max(31),
  meses_competencia: z.number().int().min(-3).max(0),
  mensagem: z.string().max(500).nullable().optional(),
  ativo: z.boolean().default(true),
});
