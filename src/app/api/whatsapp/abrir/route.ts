export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { ok, tratar, ErroApi } from '@/lib/api';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { um } from '@/lib/db';
import { criarLinkEnvio } from '@/lib/envio/ator';
import { mesPorExtenso, dataCurta } from '@/lib/tempo';
import { texto } from '@/lib/notificacoes/textos';

/**
 * Reserva desde o primeiro dia: "Abrir no WhatsApp" monta um wa.me com a
 * mensagem e o link de envio já preenchidos; o atendente envia pelo WhatsApp
 * de hoje. Sem custo e sem integração.
 */
export async function POST(req: Request) {
  return tratar(async () => {
    await exigirFuncionario();
    const d = z.object({ itemId: z.string().uuid(), loginId: z.string().uuid() }).parse(await req.json());
    const i = await um<{ empresa_id: string; empresa: string; competencia: string; prazo: string | null; nome: string }>(
      `SELECT i.empresa_id, e.nome AS empresa, to_char(i.competencia, 'YYYY-MM-DD') AS competencia, to_char(i.prazo, 'YYYY-MM-DD') AS prazo, l.nome
       FROM itens_pedido i JOIN empresas e ON e.id = i.empresa_id
       JOIN vinculos_login_empresa v ON v.empresa_id = i.empresa_id AND v.login_id = $2 JOIN logins_cliente l ON l.id = v.login_id AND l.ativo
       WHERE i.id = $1`, [d.itemId, d.loginId]);
    if (!i) throw new ErroApi('Este contato não tem acesso a esta empresa.');
    const token = await criarLinkEnvio({ loginId: d.loginId, empresaId: i.empresa_id, itemId: d.itemId, origem: 'whatsapp' });
    // Número confirmado em Acessos primeiro; sem ele, o telefone do cadastro da empresa (avisado na tela).
    const confirmado = (await um<{ numero: string }>(`SELECT numero FROM numeros_whatsapp WHERE login_id = $1 AND ativo ORDER BY confirmado_em DESC LIMIT 1`, [d.loginId]))?.numero;
    const numero = confirmado
      ?? (await um<{ n: string }>(`SELECT telefone_e164 AS n FROM contatos_empresa WHERE empresa_id = $1 AND telefone_e164 IS NOT NULL LIMIT 1`, [i.empresa_id]))?.n ?? '';
    const msg = `${await texto('wa.pedido.manual', { nome: i.nome.split(' ')[0], empresa: i.empresa, mes: mesPorExtenso(i.competencia), prazo: i.prazo ? dataCurta(i.prazo, true) : 'o quanto antes' })}\n${process.env.APP_URL ?? new URL(req.url).origin}/enviar/${token}`;
    return ok({ url: `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, numero, texto: msg, confirmado: Boolean(confirmado) });
  });
}
