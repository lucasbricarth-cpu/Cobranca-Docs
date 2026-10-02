import { ScanLine, ShieldCheck } from 'lucide-react';
import { exigirCliente } from '@/lib/auth/sessao';
import { BotoesEnvio } from '@/components/envio/BotoesEnvio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enviar' };

/** Enviar sem pedido: o app identifica o tipo e o mês; o cliente confirma antes de enviar. */
export default async function Enviar() {
  const s = await exigirCliente();
  const empresas = s.empresas.map((e) => ({ id: e.id, nome: e.nome, cnpj: e.cnpj }));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina">Enviar documento</h1>
        <p className="text-[14px] text-fg-3 mt-1">Sem pedido? Mande assim mesmo. O app identifica o tipo e o mês, e você confirma antes de enviar.</p>
      </div>
      <section className="card p-4 flex flex-col gap-3">
        <span className="icone-id"><ScanLine /></span>
        <BotoesEnvio item={null} empresas={empresas} escanear />
        <BotoesEnvio item={null} empresas={empresas} grande />
      </section>
      <p className="text-[12.5px] text-fg-3 flex gap-2"><ShieldCheck size={15} className="shrink-0" />Os arquivos ficam guardados com segurança e só o escritório vê. Documentos de saúde de funcionário têm cuidado extra.</p>
    </div>
  );
}
