import { Estetica } from '@/components/design/Estetica';

export const metadata = { title: 'Estética' };
export default function PaginaEstetica() {
  return (
    <div>
      <h1 className="titulo-pagina mb-1">Estética</h1>
      <p className="text-[13.5px] text-fg-3 mb-5">Só para você: cada pessoa do escritório tem a sua. O portal do cliente fica sempre dourado.</p>
      <Estetica />
    </div>
  );
}
