import { exigirFuncionario } from '@/lib/auth/sessao';
import { listarModelos } from '@/lib/agenda';
import { listarTipos } from '@/lib/documentos/tipos';
import { todos } from '@/lib/db';
import { Agenda } from './Agenda';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agenda' };

/** Modelos de pedidos recorrentes por perfil, aplicados a cada empresa e editáveis por empresa. */
export default async function PaginaAgenda() {
  const s = await exigirFuncionario();
  const [modelos, tipos, empresas, ultima] = await Promise.all([
    listarModelos(), listarTipos(true),
    todos<{ id: string; nome: string }>(`SELECT id, nome FROM empresas WHERE ativo ORDER BY nome`),
    todos<{ dia: string; resumo: Record<string, number> | null }>(`SELECT to_char(dia, 'YYYY-MM-DD') AS dia, resumo FROM execucoes_job WHERE nome = 'agenda' ORDER BY dia DESC LIMIT 1`),
  ]);
  return (
    <div className="max-w-[900px]">
      <h1 className="titulo-pagina mb-1">Agenda</h1>
      <p className="text-[13px] text-fg-3 mb-5">
        Um job diário, no horário de São Paulo, cria os pedidos do dia para todas as contas ativas de cada empresa.
        {ultima[0] ? ` Última execução: ${ultima[0].dia.split('-').reverse().join('/')}${ultima[0].resumo ? `, ${ultima[0].resumo.itens ?? 0} itens criados` : ''}.` : ''}
      </p>
      <Agenda admin={s.papel === 'admin'} modelos={modelos} tipos={tipos.map((t) => ({ id: t.id, nome: t.nome }))} empresas={empresas} />
    </div>
  );
}
