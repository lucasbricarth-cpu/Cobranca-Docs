import { Share, PlusSquare, Smartphone, Bell } from 'lucide-react';
import { Marca } from '@/components/ui/Marca';

export const metadata = { title: 'Instalar o app' };
/** Ensina o "Adicionar à Tela de Início" no iPhone (e o Instalar no Android/computador). */
export default function Instalar() {
  const passos = [
    { Icone: Share, t: 'No Safari, toque no botão Compartilhar', s: 'O quadrado com a seta para cima, na barra de baixo.' },
    { Icone: PlusSquare, t: 'Escolha "Adicionar à Tela de Início"', s: 'Role a lista de opções até encontrar.' },
    { Icone: Smartphone, t: 'Toque em Adicionar', s: 'O ícone aparece na tela como um app.' },
    { Icone: Bell, t: 'Abra pelo ícone e ative os avisos', s: 'No iPhone (iOS 16.4 ou mais novo) os avisos só funcionam pelo app instalado.' },
  ];
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-[460px] p-6 md:p-8 gd-rise" style={{ borderRadius: 26 }}>
        <div className="mb-5"><Marca /></div>
        <h1 className="titulo-pagina mb-1">Instalar no celular</h1>
        <p className="text-[13.5px] text-fg-3 mb-5">No iPhone, o app é instalado pelo Safari. No Android e no computador, use o botão &quot;Instalar&quot; do navegador.</p>
        <ol className="lista">
          {passos.map(({ Icone, t, s }, i) => (
            <li key={t} className="linha">
              <span className="icone-id"><Icone /></span>
              <span className="flex-1"><div className="linha-titulo">{i + 1}. {t}</div><div className="linha-sub">{s}</div></span>
            </li>
          ))}
        </ol>
        <a href="/" className="btn btn-primary btn-lg w-full mt-5">Continuar</a>
      </div>
    </main>
  );
}
