import { um } from '@/lib/db';
import { autorizarEmpresa, NaoAutorizado, type Sessao } from '@/lib/auth/sessao';

/**
 * Regras de acesso num lugar só. O servidor valida a empresa em TODA
 * requisição a partir dos vínculos do login; nunca confia no id que vem do
 * aparelho.
 */
export { autorizarEmpresa };

/** Funcionário vê todas as empresas; cliente, só as dos vínculos. */
export function exigirEmpresa(sessao: Sessao, empresaId: string | null | undefined): string {
  if (!empresaId) throw new NaoAutorizado('Empresa não informada.');
  autorizarEmpresa(sessao, empresaId);
  return empresaId;
}

/** Tipos sensíveis só abrem para os Admins e para o responsável da folha daquela empresa. */
export async function podeVerSensivel(sessao: Sessao, empresaId: string | null): Promise<boolean> {
  if (sessao.tipo === 'cliente') return false; // o cliente vê o que ele mesmo enviou (tratado à parte)
  if (sessao.papel === 'admin') return true;
  if (!empresaId) return false;
  const r = await um(`SELECT 1 FROM responsaveis_empresa WHERE empresa_id = $1 AND usuario_id = $2 AND papel = 'folha'`, [empresaId, sessao.id]);
  return Boolean(r);
}

/** A pasta geral de Não reconhecidos (sem empresa) só abre para Admins e responsáveis. */
export async function podeVerPastaGeral(sessao: Sessao): Promise<boolean> {
  if (sessao.tipo !== 'funcionario') return false;
  if (sessao.papel === 'admin') return true;
  const r = await um(`SELECT 1 FROM responsaveis_empresa WHERE usuario_id = $1 LIMIT 1`, [sessao.id]);
  return Boolean(r);
}
