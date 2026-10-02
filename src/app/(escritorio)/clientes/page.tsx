import { exigirFuncionario } from '@/lib/auth/sessao';
import { listarEmpresas, funcionariosAtivos } from '@/lib/consultas/empresas';
import { competenciaDoMes } from '@/lib/tempo';
import { ListaClientes } from '@/components/clientes/ListaClientes';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default async function Clientes({ searchParams }: { searchParams: { q?: string; resp?: string } }) {
  const s = await exigirFuncionario();
  const [empresas, funcionarios] = await Promise.all([
    listarEmpresas({ busca: searchParams.q, responsavelId: searchParams.resp, competencia: competenciaDoMes() }),
    funcionariosAtivos(),
  ]);
  return (
    <div className="max-w-[860px]">
      <div className="flex items-end justify-between gap-3 mb-4">
        <h1 className="titulo-pagina">Clientes</h1>
        <span className="text-[12.5px] text-fg-3 mono">{empresas.length} empresas</span>
      </div>
      <ListaClientes empresas={empresas} busca={searchParams.q} responsavel={searchParams.resp} funcionarios={funcionarios} meuId={s.id} />
    </div>
  );
}
