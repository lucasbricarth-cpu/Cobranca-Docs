import { um } from '@/lib/db';
import type { Funcionario } from '@/lib/auth/sessao';

/** Contadores das barras (a fila A conferir e os Não reconhecidos do funcionário). */
export async function contadoresDoFuncionario(s: Funcionario): Promise<{ conferir: number; naoReconhecidos: number }> {
  try {
    const r = await um<{ conferir: string; nao: string }>(
      `SELECT
         (SELECT count(*) FROM documentos d LEFT JOIN empresas e ON e.id = d.empresa_id
           WHERE d.status = 'a_conferir' AND d.excluido_em IS NULL AND ($1 OR e.responsavel_id = $2)) AS conferir,
         (SELECT count(*) FROM documentos d LEFT JOIN empresas e ON e.id = d.empresa_id
           WHERE d.status = 'nao_reconhecido' AND d.excluido_em IS NULL AND ($1 OR e.responsavel_id = $2 OR d.empresa_id IS NULL)) AS nao`,
      [s.papel === 'admin', s.id]);
    return { conferir: Number(r?.conferir ?? 0), naoReconhecidos: Number(r?.nao ?? 0) };
  } catch {
    // Antes da migration 002 a tabela documentos não existe.
    return { conferir: 0, naoReconhecidos: 0 };
  }
}
