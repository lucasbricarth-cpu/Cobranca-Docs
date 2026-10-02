import Link from 'next/link';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { podeVerPastaGeral } from '@/lib/acesso';
import { listarArquivos } from '@/lib/documentos/consultas';
import { listarTipos } from '@/lib/documentos/tipos';
import { todos } from '@/lib/db';
import { comParametros, uuidOuNada } from '@/lib/url';
import { competenciaDoMes } from '@/lib/tempo';
import { ListaPorMes } from '@/components/documentos/ListaPorMes';
import { AlvosDeTipo } from '@/components/documentos/AlvosDeTipo';
import { PainelDocumento } from '@/components/documentos/PainelDocumento';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'A conferir' };

type P = { aba?: string; todas?: string; doc?: string };

/**
 * Fila de trabalho do responsável. "A conferir" (há sugestão de tipo) e
 * "Não reconhecidos" (sem tipo, ou sem empresa: a pasta geral do escritório,
 * que só os Admins e os responsáveis veem) são coisas diferentes.
 */
export default async function Conferir({ searchParams: bruto }: { searchParams: P }) {
  const s = await exigirFuncionario();
  const sp: P = { ...bruto, doc: uuidOuNada(bruto.doc) };
  const aba = sp.aba === 'nao' ? 'nao' : 'conferir';
  const soMinhas = s.papel !== 'admin' && sp.todas !== '1';
  const pastaGeral = await podeVerPastaGeral(s);
  const [arquivos, tipos, empresas] = await Promise.all([
    listarArquivos({
      aConferir: aba === 'conferir', naoReconhecidos: aba === 'nao', podeSensivel: s.papel === 'admin', usuarioFolhaId: s.id,
      responsavelId: soMinhas ? s.id : null, pastaGeral, limite: 500,
    }),
    listarTipos(true),
    todos<{ id: string; nome: string }>(`SELECT id, nome FROM empresas WHERE ativo ORDER BY nome`),
  ]);
  const atuais = sp as Record<string, string | undefined>;
  const nomes = Object.fromEntries(empresas.map((e) => [e.id, e.nome]));
  return (
    <div className="tres-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)' }}>
      <section className="col col-meio">
        <div className="empresa-topo">
          <h1 className="titulo-pagina mb-3">{aba === 'nao' ? 'Não reconhecidos' : 'A conferir'}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="seg" role="tablist">
              <Link role="tab" aria-selected={aba === 'conferir'} href={comParametros({ todas: sp.todas }, {})} className={`seg-item ${aba === 'conferir' ? 'active' : ''}`}>A conferir</Link>
              <Link role="tab" aria-selected={aba === 'nao'} href={comParametros({ todas: sp.todas }, { aba: 'nao' })} className={`seg-item ${aba === 'nao' ? 'active' : ''}`}>Não reconhecidos</Link>
            </div>
            {s.papel !== 'admin' && (
              <div className="chips">
                <Link href={comParametros(atuais, { todas: null, doc: null })} className={`chip ${soMinhas ? 'active' : ''}`}>Minhas empresas</Link>
                <Link href={comParametros(atuais, { todas: '1', doc: null })} className={`chip ${!soMinhas ? 'active' : ''}`}>Todas</Link>
              </div>
            )}
          </div>
        </div>
        {aba === 'nao' && <AlvosDeTipo tipos={tipos.filter((t) => s.papel === 'admin' || !t.sensivel)} empresas={empresas} competencia={competenciaDoMes()} />}
        <ListaPorMes arquivos={arquivos} hrefDoc={comParametros(atuais, { doc: '__DOC__' })} docAtivo={sp.doc} arrastavel mostrarEmpresa />
      </section>
      <PainelDocumento docId={sp.doc} hrefFechar={comParametros(atuais, { doc: null })} tipos={tipos} empresas={empresas} nomesEmpresas={nomes} />
    </div>
  );
}
