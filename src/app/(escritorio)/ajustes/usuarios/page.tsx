import { exigirAdmin } from '@/lib/auth/sessao';
import { todos } from '@/lib/db';
import { Usuarios } from './Usuarios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuários' };

export default async function PaginaUsuarios() {
  const s = await exigirAdmin();
  const usuarios = await todos<{ id: string; nome: string; email: string; papel: 'admin' | 'funcionario'; ativo: boolean; i_responsavel_dominio: number | null; empresas: string }>(
    `SELECT u.id, u.nome, u.email, u.papel, u.ativo, u.i_responsavel_dominio,
            (SELECT count(*) FROM empresas e WHERE e.responsavel_id = u.id) AS empresas
     FROM usuarios u ORDER BY u.ativo DESC, u.nome`);
  return (
    <div className="max-w-[760px]">
      <h1 className="titulo-pagina mb-1">Usuários</h1>
      <p className="text-[13px] text-fg-3 mb-5">Funcionários do escritório. O código de responsável liga o funcionário às empresas dele na Domínio.</p>
      <Usuarios meuId={s.id} usuarios={usuarios.map((u) => ({ ...u, empresas: Number(u.empresas) }))} />
    </div>
  );
}
