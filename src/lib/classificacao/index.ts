import type { TipoReal } from '@/lib/seguranca/tipo-arquivo';

/**
 * Classificação do arquivo depois do antivírus. A Etapa 6 implementa as
 * regras (XML de NF-e, OFX, IA só para foto e PDF). Aqui fica o contrato.
 */
export interface ContextoClassificacao {
  documentoId: string;
  empresaId: string | null;
  tipoId: string | null;        // escolhido pelo cliente ou vindo do pedido
  subtipoId: string | null;
  competencia: string | null;
  comPedido: boolean;
  sensivel: boolean;
  loginId: string | null;
  tipoReal: TipoReal;
}
export interface DecisaoClassificacao {
  tipoId: string | null;
  subtipoId: string | null;
  empresaId: string | null;
  competencia: string | null;
  cnpjs: string[];
  sugestao: Record<string, unknown> | null;
  /** 'a_conferir' (há sugestão de tipo), 'nao_reconhecido' (sem tipo ou sem empresa) ou 'conferido' (arquivamento automático). */
  status: 'a_conferir' | 'nao_reconhecido' | 'conferido';
  avisoMes?: string | null;      // ex.: o mês do XML não bate com o pedido
}

export async function classificarEnvio(ctx: ContextoClassificacao, _dados: Buffer): Promise<DecisaoClassificacao> {
  const status = ctx.empresaId && ctx.tipoId ? 'a_conferir' : 'nao_reconhecido';
  return { tipoId: ctx.tipoId, subtipoId: ctx.subtipoId, empresaId: ctx.empresaId, competencia: ctx.competencia, cnpjs: [], sugestao: null, status };
}
