import { q, todos, um } from '@/lib/db';
import { registrarEnvio } from '@/lib/documentos/registrar';
import { rodarFila } from '@/lib/fila';
import { pdfDemo, fotoDemo, xmlNfeDemo } from './demo-arquivos';
import { competenciaPadrao, somarMeses } from '@/lib/tempo';
import { criarPedido } from '@/lib/pedidos';
import { confirmarNumero, registrarAceite } from '@/lib/whatsapp/numeros';

/**
 * Documentos e itens de demonstração (só desenvolvimento e capturas):
 * o mês anterior da Padaria com cada status, meses mais antigos no Arquivo,
 * uma versão substituída, um não reconhecido, um sensível e um arquivo sem
 * empresa (número desconhecido no WhatsApp). Idempotente.
 */
export async function semearDocumentos() {
  const emp = Object.fromEntries((await todos<{ codi_emp: number; id: string }>(`SELECT codi_emp, id FROM empresas`)).map((e) => [e.codi_emp, e.id]));
  const tipo = Object.fromEntries((await todos<{ nome: string; id: string }>(`SELECT nome, id FROM tipos_documento`)).map((t) => [t.nome, t.id]));
  const padaria = emp[101];
  const login = (await um<{ id: string }>(`SELECT id FROM logins_cliente WHERE email = 'carlos@padaria.com.br'`))!.id;
  await q(`INSERT INTO subtipos (empresa_id, tipo_id, cartao_final, cartao_emissor) VALUES ($1, $2, '3310', 'Itaú') ON CONFLICT DO NOTHING`, [padaria, tipo['Fatura de cartão']]);
  const sub = async (rotulo: string) => {
    const r = await um<{ id: string }>(
      `SELECT s.id FROM subtipos s LEFT JOIN contas_bancarias c ON c.id = s.conta_bancaria_id WHERE s.empresa_id = $1 AND (c.final = $2 OR s.cartao_final = $2)`, [padaria, rotulo]);
    return r!.id;
  };
  const [itau, sicredi, cartao] = [await sub('0567'), await sub('0921'), await sub('3310')];
  const mes = competenciaPadrao();
  const mesAnt = somarMeses(mes, -1);
  const prazo = `${somarMeses(mes, 1).slice(0, 8)}05`;
  const prazoVencido = `${mes.slice(0, 8)}28`;

  const item = async (tipoId: string, subtipoId: string | null, comp: string, pz: string) => (await um<{ id: string }>(
    `INSERT INTO itens_pedido (empresa_id, tipo_id, subtipo_id, competencia, prazo) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT um_item_por_competencia DO UPDATE SET prazo = EXCLUDED.prazo RETURNING id`, [padaria, tipoId, subtipoId, comp, pz]))!.id;
  const iItau = await item(tipo['Extrato bancário'], itau, mes, prazo);
  const iSic = await item(tipo['Extrato bancário'], sicredi, mes, prazo);
  const iCartao = await item(tipo['Fatura de cartão'], cartao, mes, prazoVencido);
  const iNfe = await item(tipo['Notas fiscais de entrada'], null, mes, prazo);
  const iNfs = await item(tipo['Notas fiscais de saída'], null, mes, prazo);
  const iFolha = await item(tipo['Folha: ponto e eventos'], null, mes, prazo);
  const iItauAnt = await item(tipo['Extrato bancário'], itau, mesAnt, `${mes.slice(0, 8)}05`);
  const iSicAnt = await item(tipo['Extrato bancário'], sicredi, mesAnt, `${mes.slice(0, 8)}05`);

  const env = async (nome: string, dados: Buffer, o: Partial<Parameters<typeof registrarEnvio>[0]>) =>
    registrarEnvio({ dados, nomeOriginal: nome, origem: 'app', empresaId: padaria, loginId: login, ...o });

  const docs = {
    itau: await env('extrato_itau_set.pdf', await pdfDemo('Itaú · Extrato', ['Agência 0912  Conta 1056-7', 'PADARIA DO BAIRRO LTDA  CNPJ 11.222.333/0001-81', `Período: ${mes.slice(5, 7)}/${mes.slice(0, 4)}`]), { tipoId: tipo['Extrato bancário'], subtipoId: itau, competencia: mes, itemId: iItau, origem: 'whatsapp', whatsappNumero: '5511988887777' }),
    itauV1: await env('IMG_2031.jpg', await fotoDemo('Itaú extrato (foto)', '#e9e2d2'), { tipoId: tipo['Extrato bancário'], subtipoId: itau, competencia: mesAnt, itemId: iItauAnt }),
    itauAnt: await env('extrato_itau_ago.pdf', await pdfDemo('Itaú · Extrato', ['Agência 0912  Conta 1056-7', `Período: ${mesAnt.slice(5, 7)}/${mesAnt.slice(0, 4)}`]), { tipoId: tipo['Extrato bancário'], subtipoId: itau, competencia: mesAnt, itemId: iItauAnt }),
    sicAnt: await env('sicredi_agosto.pdf', await pdfDemo('Sicredi · Extrato', ['Cooperativa 0710  Conta 12092-1', `Período: ${mesAnt.slice(5, 7)}/${mesAnt.slice(0, 4)}`]), { tipoId: tipo['Extrato bancário'], subtipoId: sicredi, competencia: mesAnt, itemId: iSicAnt }),
    nfe: await env('NFe_entrada_4471.xml', xmlNfeDemo('45723174000110', '11222333000181', `${mes.slice(0, 8)}12`, 4471), { tipoId: tipo['Notas fiscais de entrada'], competencia: mes, itemId: iNfe }),
    nfs: await env('notas_saida.jpg', await fotoDemo('Notas de saída', '#d9d3c4'), { tipoId: tipo['Notas fiscais de saída'], competencia: mes, itemId: iNfs }),
    naoRec: await env('documento.pdf', await pdfDemo('Comprovante', ['Documento sem tipo identificado', 'Recebido sem pedido']), { tipoId: null, competencia: null }),
    atestado: await env('atestado_joao.jpg', await fotoDemo('Atestado médico', '#f2f2f2'), { tipoId: tipo['Atestados e exames de funcionário'], competencia: mes, sensivel: true }),
    // Chega pelo WhatsApp sem tipo: a classificação (IA) sugere "Extrato bancário › Itaú final 0567".
    viaWhats: await env('extrato_whatsapp_out.pdf', await pdfDemo('Itaú · Extrato', ['Agência 0912  Conta 1056-7', 'PADARIA DO BAIRRO LTDA  CNPJ 11.222.333/0001-81', 'Período: 10/2026']), { tipoId: null, competencia: `${somarMeses(mes, 1)}`, origem: 'whatsapp', whatsappNumero: '5511988887777' }),
    semEmpresa: await env('IMG-20261001-WA0007.jpg', await fotoDemo('Boleto', '#efe9dc'), { empresaId: null, loginId: null, origem: 'whatsapp', whatsappNumero: '5521977776666' }),
  };
  for (let i = 0; i < 4 && (await rodarFila(50)) > 0; i++) { /* processa tudo */ }

  // Ajustes de demonstração: datas, conferências, uma rejeição e um lembrete.
  const ajustar = (id: string, data: string) => q(`UPDATE documentos SET recebido_em = $2 WHERE id = $1`, [id, data]);
  await ajustar(docs.itau.id, `${somarMeses(mes, 1).slice(0, 8)}01 09:12-03`);
  await ajustar(docs.itauV1.id, `${mes.slice(0, 8)}03 18:40-03`);
  await ajustar(docs.itauAnt.id, `${mes.slice(0, 8)}04 08:05-03`);
  await ajustar(docs.sicAnt.id, `${mes.slice(0, 8)}04 08:07-03`);
  for (const d of [docs.itau, docs.itauAnt, docs.sicAnt]) {
    await q(`UPDATE documentos SET status = 'conferido', conferido_em = now() WHERE id = $1 AND status = 'a_conferir'`, [d.id]);
    await q(`UPDATE itens_pedido SET status = 'conferido', conferido_em = now() WHERE documento_id = $1`, [d.id]);
  }
  await q(`UPDATE documentos SET status = 'rejeitado', motivo_rejeicao = 'A foto ficou ilegível. Envie de novo, por favor.' WHERE id = $1 AND status = 'a_conferir'`, [docs.nfs.id]);
  await q(`UPDATE itens_pedido SET status = 'refazer', motivo_refazer = 'A foto ficou ilegível. Envie de novo, por favor.' WHERE id = $1`, [iNfs]);
  await q(`INSERT INTO avisos (item_id, login_id, canal, etapa, destino, texto, enviado_em) VALUES ($1, $2, 'email', 'lembrete_3dias', 'carlos@padaria.com.br', 'Um pedido do escritório vence em 3 dias.', $3)
           ON CONFLICT ON CONSTRAINT aviso_unico DO NOTHING`, [iSic, login, `${somarMeses(mes, 1).slice(0, 8)}02 08:00-03`]);
  void iFolha; void iCartao;
  // Um pedido avulso para a carteira toda (os itens que já existiam não duplicam).
  const admin = (await um<{ id: string }>(`SELECT id FROM usuarios WHERE papel = 'admin' ORDER BY criado_em LIMIT 1`))!.id;
  // WhatsApp do Carlos: número confirmado pelo escritório e aceite registrado (demonstração).
  await confirmarNumero(login, '11988887777', admin);
  await registrarAceite(login, 'presencial', null, admin);
  const ja = await um(`SELECT 1 FROM pedidos WHERE origem = 'avulso' AND competencia = $1 AND tipo_id = $2`, [mes, tipo['Extrato bancário']]);
  if (!ja) await criarPedido({ empresaIds: Object.values(emp), tipoId: tipo['Extrato bancário'], subtipos: 'todos', competencia: mes, prazo, mensagem: 'Extratos de todas as contas, por favor.', origem: 'avulso', criadoPor: admin });
  const ja2 = await um(`SELECT 1 FROM pedidos WHERE origem = 'avulso' AND competencia = $1 AND tipo_id = $2`, [mes, tipo['Notas fiscais de entrada']]);
  if (!ja2) await criarPedido({ empresaIds: Object.values(emp), tipoId: tipo['Notas fiscais de entrada'], subtipos: 'todos', competencia: mes, prazo: prazoVencido, origem: 'avulso', criadoPor: admin });
  return { mes, documentos: Object.keys(docs).length };
}
