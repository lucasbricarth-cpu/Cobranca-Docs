import { um } from '@/lib/db';
import { NaoAutorizado, type Sessao } from '@/lib/auth/sessao';
import { podeVerSensivel, podeVerPastaGeral } from '@/lib/acesso';

/**
 * Quem pode abrir um documento (e a miniatura, que segue as permissões do original):
 * - funcionário: qualquer empresa; sensível só Admin ou responsável da folha da empresa;
 *   sem empresa (pasta geral) só Admins e responsáveis;
 * - cliente: só empresas dos vínculos; sensível só o que ele mesmo enviou.
 */
export interface DocBasico { id: string; empresa_id: string | null; sensivel: boolean; enviado_por_login: string | null; status: string; chave: string; miniatura_chave: string | null; mime: string; excluido_em: Date | null }

export async function carregarComPermissao(sessao: Sessao, id: string): Promise<DocBasico> {
  const d = await um<DocBasico>(
    `SELECT d.id, d.empresa_id, (d.sensivel OR coalesce(t.sensivel, false)) AS sensivel, d.enviado_por_login, d.status, d.chave, d.miniatura_chave, d.mime, d.excluido_em
     FROM documentos d LEFT JOIN tipos_documento t ON t.id = d.tipo_id WHERE d.id = $1`, [id]);
  if (!d || d.excluido_em || d.status === 'processando' || d.status === 'recusado') throw new NaoAutorizado('Documento não encontrado.');
  if (!(await podeAbrir(sessao, d))) throw new NaoAutorizado('Sem permissão para este documento.');
  return d;
}

export async function podeAbrir(sessao: Sessao, d: Pick<DocBasico, 'empresa_id' | 'sensivel' | 'enviado_por_login'>): Promise<boolean> {
  if (sessao.tipo === 'cliente') {
    if (!d.empresa_id || !sessao.empresas.some((e) => e.id === d.empresa_id)) return false;
    return !d.sensivel || d.enviado_por_login === sessao.id;
  }
  if (!d.empresa_id) return podeVerPastaGeral(sessao);
  if (d.sensivel) return podeVerSensivel(sessao, d.empresa_id);
  return true;
}
