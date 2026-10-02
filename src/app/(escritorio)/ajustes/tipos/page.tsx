import { exigirAdmin } from '@/lib/auth/sessao';
import { listarTipos } from '@/lib/documentos/tipos';
import { Tipos } from './Tipos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tipos de documento' };

export default async function PaginaTipos() {
  await exigirAdmin();
  return (
    <div className="max-w-[820px]">
      <h1 className="titulo-pagina mb-1">Tipos de documento</h1>
      <p className="text-[13px] text-fg-3 mb-5">A regra de mês vale para envios sem pedido. Tipos sensíveis nunca vão para a IA, não têm miniatura e só abrem para o responsável da folha e os Admins.</p>
      <Tipos tipos={await listarTipos()} />
    </div>
  );
}
