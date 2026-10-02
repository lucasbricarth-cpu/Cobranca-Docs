import { exigirFuncionario } from '@/lib/auth/sessao';
import { listarTipos } from '@/lib/documentos/tipos';
import { todos } from '@/lib/db';
import { competenciaPadrao } from '@/lib/tempo';
import { uuidOuNada } from '@/lib/url';
import { NovoPedido } from './NovoPedido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Novo pedido' };

export default async function Pagina({ searchParams }: { searchParams: { empresa?: string } }) {
  await exigirFuncionario();
  const [tipos, empresas] = await Promise.all([
    listarTipos(true),
    todos<{ id: string; nome: string; perfil: string; tem_folha: boolean; responsavel_id: string | null }>(`SELECT id, nome, perfil, tem_folha, responsavel_id FROM empresas WHERE ativo ORDER BY nome`),
  ]);
  return (
    <div className="max-w-[720px]">
      <h1 className="titulo-pagina mb-1">Novo pedido</h1>
      <p className="text-[13px] text-fg-3 mb-5">Para uma empresa ou várias. Pedir de novo o que já foi pedido não duplica: só cria o que falta.</p>
      <NovoPedido tipos={tipos.map((t) => ({ id: t.id, nome: t.nome, subtipo_origem: t.subtipo_origem, regra_mes: t.regra_mes }))} empresas={empresas} competenciaPadrao={competenciaPadrao()} empresaInicial={uuidOuNada(searchParams.empresa)} />
    </div>
  );
}
