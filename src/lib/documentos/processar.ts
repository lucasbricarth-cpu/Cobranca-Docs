import { q, um, transacao } from '@/lib/db';
import { armazenamento } from '@/lib/armazenamento';
import { registrarTarefa } from '@/lib/fila';
import { detectarTipo, pdfTemJavascript } from '@/lib/seguranca/tipo-arquivo';
import { verificarAntivirus } from '@/lib/seguranca/antivirus';
import { gerarMiniatura } from './miniatura';
import { classificarEnvio } from '@/lib/classificacao';
import { vincularAoItem, registrarAuditoria } from './acoes';
import { aoReceberDocumento } from '@/lib/notificacoes/gatilhos';

/**
 * Processa um documento que acabou de chegar (fila 'processar_documento'):
 * 1. antivírus (ClamAV) — antes de aparecer em qualquer pasta;
 * 2. tipo real pelo conteúdo e recusa de PDF com JavaScript;
 * 3. sai da quarentena;
 * 4. miniatura da primeira página (nunca em sensível);
 * 5. classificação (Etapa 6) e vínculo ao item do pedido (versões).
 */
interface DocProc {
  id: string; empresa_id: string | null; tipo_id: string | null; subtipo_id: string | null; competencia: string | null;
  item_id: string | null; com_pedido: boolean; sensivel: boolean; status: string; chave: string; enviado_por_login: string | null;
  tipo_sensivel: boolean | null;
}

export async function processarDocumento(id: string): Promise<void> {
  const d = await um<DocProc>(
    `SELECT d.id, d.empresa_id, d.tipo_id, d.subtipo_id, to_char(d.competencia, 'YYYY-MM-DD') AS competencia, d.item_id, d.com_pedido,
            d.sensivel, d.status, d.chave, d.enviado_por_login, t.sensivel AS tipo_sensivel
     FROM documentos d LEFT JOIN tipos_documento t ON t.id = d.tipo_id WHERE d.id = $1`, [id]);
  if (!d || d.status !== 'processando') return;
  const arm = armazenamento();
  const dados = await arm.ler(d.chave);

  const av = await verificarAntivirus(dados);
  if (!av.limpo) return recusar(d, `Antivírus: ${av.ameaca}`);
  const real = detectarTipo(dados);
  if (!real) return recusar(d, 'Tipo de arquivo não aceito.');
  if (real.familia === 'pdf' && (await pdfTemJavascript(dados))) return recusar(d, 'PDF com JavaScript embutido.');

  const chaveFinal = `docs/${d.id}.${real.extensao}`;
  await arm.salvar(chaveFinal, dados, real.mime);
  await arm.apagar(d.chave);
  await q(`UPDATE documentos SET chave = $2, mime = $3, extensao = $4 WHERE id = $1`, [d.id, chaveFinal, real.mime, real.extensao]);

  const sensivel = d.sensivel || Boolean(d.tipo_sensivel);
  if (!sensivel) {
    try {
      const m = await gerarMiniatura(dados, real.familia);
      if (m) {
        const chaveMini = `miniaturas/${d.id}.webp`;
        await arm.salvar(chaveMini, m.png, 'image/webp');
        await q(`UPDATE documentos SET miniatura_chave = $2, paginas = $3 WHERE id = $1`, [d.id, chaveMini, m.paginas ?? null]);
      }
    } catch (e) {
      console.warn('[miniatura]', d.id, (e as Error).message); // sem miniatura, o arquivo segue
    }
  }

  const decisao = await classificarEnvio({
    documentoId: d.id, empresaId: d.empresa_id, tipoId: d.tipo_id, subtipoId: d.subtipo_id, competencia: d.competencia,
    comPedido: d.com_pedido, sensivel, loginId: d.enviado_por_login, tipoReal: real,
  }, dados);

  await transacao(async (c) => {
    await c.query(
      `UPDATE documentos SET empresa_id = $2, tipo_id = $3, subtipo_id = $4, competencia = $5, status = $6, sugestao = $7, cnpjs_lidos = $8,
              conferido_em = CASE WHEN $6 = 'conferido' THEN now() END
       WHERE id = $1`,
      [d.id, decisao.empresaId, decisao.tipoId, decisao.subtipoId, decisao.competencia, decisao.status,
        decisao.sugestao ? JSON.stringify(decisao.sugestao) : null, decisao.cnpjs.length ? decisao.cnpjs : null]);
    if (decisao.status === 'conferido') {
      await registrarAuditoria(c, d.id, 'conferido_automatico', null, { status: 'conferido' }, { quem: 'Arquivamento automático' });
    }
    if (d.item_id && decisao.empresaId && decisao.status !== 'nao_reconhecido') {
      await vincularAoItem(c, d.id, d.item_id, decisao.status === 'conferido');
    }
  });
  await aoReceberDocumento(d.id);
}

async function recusar(d: DocProc, motivo: string) {
  await q(`UPDATE documentos SET status = 'recusado', motivo_recusa = $2 WHERE id = $1`, [d.id, motivo]);
  await armazenamento().apagar(d.chave);
}

registrarTarefa('processar_documento', async (dados) => processarDocumento(String(dados.id)));
