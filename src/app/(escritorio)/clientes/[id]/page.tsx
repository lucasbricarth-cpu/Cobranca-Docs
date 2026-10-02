import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Users, Tags, Lock, X, Archive } from 'lucide-react';
import { exigirFuncionario } from '@/lib/auth/sessao';
import { podeVerSensivel } from '@/lib/acesso';
import { dadosDaEmpresa, listarEmpresas, funcionariosAtivos } from '@/lib/consultas/empresas';
import { checklistDoMes, resumoDoMes, cartoesDoArquivo, listarArquivos } from '@/lib/documentos/consultas';
import { subtiposDaEmpresa } from '@/lib/documentos/subtipos';
import { listarTipos } from '@/lib/documentos/tipos';
import { competenciaPadrao, dataCurta, mesCurto } from '@/lib/tempo';
import { formatarCnpj } from '@/lib/texto';
import { nomeCurtoDoBanco } from '@/lib/bancos';
import { comParametros, uuidOuNada, uuids } from '@/lib/url';
import { SeletorMes } from '@/components/empresa/SeletorMes';
import { ChecklistMes } from '@/components/empresa/ChecklistMes';
import { BuscaArquivo } from '@/components/empresa/BuscaArquivo';
import { Progresso } from '@/components/ui/Progresso';
import { IconeTipo } from '@/components/ui/IconeTipo';
import { MedirAltura } from '@/components/ui/MedirAltura';
import { ListaClientes } from '@/components/clientes/ListaClientes';
import { ListaPorMes } from '@/components/documentos/ListaPorMes';
import { AlvosDeTipo } from '@/components/documentos/AlvosDeTipo';
import { PainelDocumento } from '@/components/documentos/PainelDocumento';
import { SugestoesEncerradas } from '@/components/empresa/SugestoesEncerradas';
import { interpretarBusca, chipsParaParametros } from '@/lib/documentos/busca';

export const dynamic = 'force-dynamic';

type P = { busca?: string; aba?: string; mes?: string; m?: string; tipo?: string; nr?: string; sub?: string; banco?: string; q?: string; doc?: string };

/**
 * Tela da empresa (funcionário). Não é uma árvore: tipo, subtipo e mês são
 * campos do registro. Abre pelo mês ("Este mês"); a aba "Arquivo" mostra os
 * mesmos dados por tipo. No computador: clientes | conteúdo | documento.
 */
export default async function Empresa({ params, searchParams: bruto }: { params: { id: string }; searchParams: P }) {
  const s = await exigirFuncionario();
  if (!uuidOuNada(params.id)) notFound();
  // Ids que vêm da URL: só UUIDs válidos chegam ao banco.
  const sp: P = { ...bruto, tipo: uuidOuNada(bruto.tipo), doc: uuidOuNada(bruto.doc), sub: uuids(bruto.sub).join(',') || undefined,
    banco: bruto.banco?.split(',').filter((c) => /^\d{1,4}$/.test(c)).join(',') || undefined,
    m: /^\d{4}-\d{2}-01$/.test(bruto.m ?? '') ? bruto.m : undefined };
  const empresa = await dadosDaEmpresa(params.id);
  if (!empresa) notFound();
  const competencia = /^\d{4}-\d{2}-01$/.test(sp.mes ?? '') ? sp.mes! : competenciaPadrao();
  const aba = sp.aba === 'arquivo' || sp.tipo || sp.nr || sp.sub || sp.banco || sp.q || sp.m ? 'arquivo' : 'mes';
  const base = `/clientes/${params.id}`;
  const atuais = sp as Record<string, string | undefined>;
  const sensivel = await podeVerSensivel(s, params.id);

  const [clientes, funcionarios, tipos, subtipos] = await Promise.all([
    listarEmpresas({ competencia }), funcionariosAtivos(), listarTipos(true), subtiposDaEmpresa(params.id),
  ]);
  const tiposVisiveis = tipos.filter((t) => sensivel || !t.sensivel);
  // ?busca=itaú setembro (link compartilhável): vira os chips e redireciona.
  if (sp.busca) {
    const { chips, resto } = interpretarBusca(sp.busca, {
      competenciaAtual: competencia, tipos: tiposVisiveis.map((t) => ({ id: t.id, nome: t.nome })),
      subtipos: subtipos.map((x) => ({ id: x.id, rotulo: x.rotulo, codigo_banco: x.codigo_banco, nome_banco: x.nome_banco, conta_final: x.conta_final, cartao_final: x.cartao_final, nome: x.nome })),
    });
    redirect(`${base}?${new URLSearchParams({ aba: 'arquivo', ...chipsParaParametros(chips), ...(resto ? { q: resto } : {}) }).toString()}`);
  }

  let conteudo: JSX.Element;
  if (aba === 'mes') {
    const itens = await checklistDoMes(params.id, competencia);
    const r = resumoDoMes(itens);
    conteudo = (
      <>
        <div className="card p-4 mb-3"><Progresso recebidos={r.recebidos} conferidos={r.conferidos} total={r.total} /></div>
        <SugestoesEncerradas subtipos={subtipos.filter((x) => x.conta_situacao === 'encerrada' && x.sugestao_encerrada_em && x.ativo).map((x) => ({ id: x.id, rotulo: x.rotulo }))} />
        <ChecklistMes itens={itens} params={atuais} docAtivo={sp.doc} />
      </>
    );
  } else if (!sp.tipo && !sp.nr && !sp.sub && !sp.banco && !sp.q && !sp.m) {
    const cartoes = await cartoesDoArquivo(params.id, sensivel);
    conteudo = cartoes.length ? (
      <div className="grade">
        {cartoes.map((c) => (
          <Link key={c.tipo_id ?? 'nr'} href={`${base}${comParametros({}, { aba: 'arquivo', ...(c.nao_reconhecidos ? { nr: '1' } : { tipo: c.tipo_id }) })}`} className="cartao-tipo" scroll={false}>
            <span className={`icone-id ${c.nao_reconhecidos ? 'neutro' : ''}`}><IconeTipo nome={c.icone} sensivel={c.sensivel} /></span>
            <span className="text-[13.5px] font-medium leading-tight flex items-center gap-1">{c.nome}{c.sensivel && <Lock size={12} aria-label="Sensível" />}</span>
            <span className="text-[12px] text-fg-3"><b className="mono text-fg">{c.quantidade}</b> arquivo{c.quantidade === 1 ? '' : 's'}{c.ultimo ? ` · último ${dataCurta(c.ultimo)}` : ''}</span>
          </Link>
        ))}
      </div>
    ) : <div className="vazio">Nenhum arquivo ainda.</div>;
  } else {
    const tipoAtual = tipos.find((t) => t.id === sp.tipo);
    const subsDoTipo = subtipos.filter((x) => x.tipo_id === sp.tipo);
    const subSel = sp.sub ? sp.sub.split(',') : [];
    const arquivos = await listarArquivos({
      empresaId: params.id, tipoId: sp.tipo ?? null, naoReconhecidos: sp.nr === '1', subtipoIds: subSel, bancos: sp.banco ? sp.banco.split(',') : undefined,
      competencia: sp.m ?? null, texto: sp.q ?? null, podeSensivel: sensivel, incluirSubstituidos: Boolean(sp.tipo),
    });
    const chipsAtivos = [
      ...subSel.map((id) => ({ k: 'sub', v: id, rotulo: subtipos.find((x) => x.id === id)?.rotulo ?? 'Subtipo' })),
      ...(sp.banco ? sp.banco.split(',').map((c) => ({ k: 'banco', v: c, rotulo: nomeCurtoDoBanco(c) })) : []),
      ...(sp.q ? [{ k: 'q', v: sp.q, rotulo: `“${sp.q}”` }] : []),
      ...(sp.m ? [{ k: 'm', v: sp.m, rotulo: mesCurto(sp.m) }] : []),
    ];
    conteudo = (
      <>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Link href={`${base}?aba=arquivo`} className="btn btn-ghost btn-sm" scroll={false}>‹ Todos os tipos</Link>
          <span className="h2">{sp.nr ? 'Não reconhecidos' : tipoAtual?.nome ?? 'Busca'}</span>
          {tipoAtual && <span className="text-[12px] text-fg-3">{sp.m ? mesCurto(sp.m) : 'todos os meses'}</span>}
        </div>
        {tipoAtual && subsDoTipo.length > 0 && (
          <div className="chips mb-3" role="group" aria-label="Filtrar por subtipo">
            <Link href={`${base}${comParametros(atuais, { sub: null, doc: null })}`} className={`chip ${subSel.length ? '' : 'active'}`} scroll={false}>Todos</Link>
            {subsDoTipo.map((x) => (
              <Link key={x.id} href={`${base}${comParametros(atuais, { sub: x.id, doc: null })}`} className={`chip ${subSel.includes(x.id) ? 'active' : ''}`} scroll={false}>
                {x.conta_final ? `${nomeCurtoDoBanco(x.codigo_banco, x.nome_banco)} ${x.conta_final}` : x.rotulo}
              </Link>
            ))}
          </div>
        )}
        {chipsAtivos.filter((c) => !tipoAtual || c.k !== 'sub').length > 0 && (
          <div className="chips mb-3">
            {chipsAtivos.filter((c) => !tipoAtual || c.k !== 'sub').map((c) => {
              const restantes = c.k === 'sub' ? subSel.filter((x) => x !== c.v).join(',') || null : c.k === 'banco' ? (sp.banco ?? '').split(',').filter((x) => x !== c.v).join(',') || null : null;
              return <Link key={c.k + c.v} href={`${base}${comParametros(atuais, { [c.k]: restantes, doc: null })}`} className="chip active" scroll={false}>{c.rotulo}<X aria-label="Remover filtro" /></Link>;
            })}
          </div>
        )}
        {sp.nr === '1' && <AlvosDeTipo tipos={tiposVisiveis} competencia={competencia} />}
        <ListaPorMes arquivos={arquivos} hrefDoc={`${base}${comParametros(atuais, { doc: '__DOC__' })}`} docAtivo={sp.doc} arrastavel={sp.nr === '1'} />
      </>
    );
  }

  return (
    <div className="tres-col">
      <aside className="col col-clientes" aria-label="Clientes">
        <ListaClientes empresas={clientes} funcionarios={funcionarios} ativoId={params.id} compacta meuId={s.id} />
      </aside>
      <section className="col col-meio">
        <MedirAltura variavel="--empresa-topo-h" className="empresa-topo">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <h1 className="titulo-pagina">{empresa.nome}</h1>
              <div className="text-[12.5px] text-fg-3 mt-1"><span className="mono">{formatarCnpj(empresa.cnpj)}</span> · {empresa.responsavel ?? 'sem responsável'}</div>
            </div>
            <div className="flex gap-1.5">
              <Link href={`${base}/subtipos`} className="btn btn-sm" title="Contas, cartões e subtipos"><Tags size={14} />Subtipos</Link>
              <Link href={`${base}/acessos`} className="btn btn-sm" title="Logins do cliente"><Users size={14} />Acessos</Link>
              {s.papel === 'admin' && <Link href={`${base}/saida`} className="btn btn-sm" title="Exportar tudo e saída do cliente"><Archive size={14} />Saída</Link>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <SeletorMes competencia={competencia} params={atuais} />
            <div className="seg" role="tablist">
              <Link role="tab" aria-selected={aba === 'mes'} className={`seg-item ${aba === 'mes' ? 'active' : ''}`} href={`${base}${comParametros({ mes: sp.mes }, {})}`} scroll={false}>Este mês</Link>
              <Link role="tab" aria-selected={aba === 'arquivo'} className={`seg-item ${aba === 'arquivo' ? 'active' : ''}`} href={`${base}${comParametros({ mes: sp.mes }, { aba: 'arquivo' })}`} scroll={false}>Arquivo</Link>
            </div>
          </div>
          {aba === 'arquivo' && (
            <div className="mt-3">
              <BuscaArquivo base={base} textoAtual={sp.q} contexto={{
                competenciaAtual: competencia,
                tipos: tiposVisiveis.map((t) => ({ id: t.id, nome: t.nome })),
                subtipos: subtipos.map((x) => ({ id: x.id, rotulo: x.rotulo, codigo_banco: x.codigo_banco, nome_banco: x.nome_banco, conta_final: x.conta_final, cartao_final: x.cartao_final, nome: x.nome })),
              }} />
            </div>
          )}
        </MedirAltura>
        {conteudo}
      </section>
      <PainelDocumento docId={sp.doc} hrefFechar={`${base}${comParametros(atuais, { doc: null })}`} tipos={tiposVisiveis} nomesEmpresas={{ [empresa.id]: empresa.nome }} />
    </div>
  );
}
