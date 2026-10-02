import { exigirAdmin } from '@/lib/auth/sessao';
import { listarTipos } from '@/lib/documentos/tipos';
import { taxaDeAcerto } from '@/lib/classificacao';
import { Classificacao } from './Classificacao';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Classificação' };

export default async function PaginaClassificacao() {
  await exigirAdmin();
  const [tipos, taxa] = await Promise.all([listarTipos(true), taxaDeAcerto()]);
  const modo = process.env.IA ?? 'nenhum';
  return (
    <div className="max-w-[860px] flex flex-col gap-4">
      <div>
        <h1 className="titulo-pagina mb-1">Classificação</h1>
        <p className="text-[13px] text-fg-3">XML de nota e OFX são lidos sem IA. Foto e PDF passam pela IA só para tipo e subtipo; o mês nunca vem da IA. Sensíveis nunca passam pela IA.</p>
      </div>
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <span className={`pill pill-dot ${modo === 'gemini' ? 'pill-ok' : 'pill-warn'}`}>{modo === 'gemini' ? 'IA: Gemini 2.5 Flash (Vertex AI, São Paulo)' : modo === 'simulada' ? 'IA simulada (desenvolvimento)' : 'IA desligada'}</span>
        <span className="text-[12.5px] text-fg-3">Se a IA demorar ou falhar, o envio segue e o arquivo vai para A conferir.</span>
      </div>
      <Classificacao
        tipos={tipos.map((t) => ({ id: t.id, nome: t.nome, sensivel: t.sensivel, auto: t.arquivamento_automatico }))}
        taxa={Object.fromEntries(taxa.map((x) => [x.tipo_id, x]))}
      />
    </div>
  );
}
