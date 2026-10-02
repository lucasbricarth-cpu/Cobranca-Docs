export const dynamic = 'force-dynamic';
import { ok, tratar } from '@/lib/api';
import { exigirAdmin } from '@/lib/auth/sessao';
import { um } from '@/lib/db';
import { DadosModelo } from '@/lib/agenda-validacao';

export async function POST(req: Request) {
  return tratar(async () => {
    await exigirAdmin();
    const d = DadosModelo.parse(await req.json());
    const r = await um<{ id: string }>(
      `INSERT INTO modelos_agenda (perfil, tipo_id, dia_criacao, dia_prazo, meses_competencia, mensagem, ativo) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (perfil, tipo_id) DO UPDATE SET dia_criacao = EXCLUDED.dia_criacao, dia_prazo = EXCLUDED.dia_prazo, meses_competencia = EXCLUDED.meses_competencia,
         mensagem = EXCLUDED.mensagem, ativo = EXCLUDED.ativo RETURNING id`,
      [d.perfil, d.tipo_id, d.dia_criacao, d.dia_prazo, d.meses_competencia, d.mensagem ?? null, d.ativo]);
    return ok({ id: r!.id });
  });
}
