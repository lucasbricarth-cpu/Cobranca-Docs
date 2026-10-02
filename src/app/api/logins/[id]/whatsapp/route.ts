export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { um } from '@/lib/db';
import { numerosDoLogin, sugestoesDeNumero, confirmarNumero, desligarNumero, registrarAceite, revogarAceite } from '@/lib/whatsapp/numeros';

/** Números (só valem depois que um funcionário confirma) e aceite do contato. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    await exigirFuncionario();
    const aceite = await um<{ aceito_em: Date; canal: string; revogado_em: Date | null }>(`SELECT aceito_em, canal, revogado_em FROM aceites_whatsapp WHERE login_id = $1`, [params.id]);
    return ok({ numeros: await numerosDoLogin(params.id), sugestoes: await sugestoesDeNumero(params.id), aceite });
  });
}
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return tratar(async () => {
    const s = await exigirFuncionario();
    const d = z.object({
      confirmar: z.string().max(30).optional(),
      desligar: z.string().uuid().optional(),
      aceite: z.object({ canal: z.enum(['whatsapp', 'app', 'email', 'presencial', 'telefone', 'contrato']), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).optional(),
      revogarAceite: z.boolean().optional(),
    }).parse(await req.json());
    if (d.confirmar) await confirmarNumero(params.id, d.confirmar, s.id);
    if (d.desligar) await desligarNumero(d.desligar);
    if (d.aceite) await registrarAceite(params.id, d.aceite.canal, d.aceite.data ? `${d.aceite.data}T12:00:00-03:00` : null, s.id);
    if (d.revogarAceite) await revogarAceite(params.id);
    return ok();
  });
}
