import { z } from 'zod';
import type { PoolClient } from 'pg';
import { transacao } from '@/lib/db';
import { final4, paraE164 } from '@/lib/texto';
import { aoSincronizarContas } from '@/lib/documentos/subtipos';

/**
 * Recebe o lote do leitor local e atualiza a cópia das empresas no app.
 * Só o que o app usa. A Domínio é a fonte das empresas, contatos,
 * responsáveis e contas; o que o escritório ajusta no app (perfil, folha,
 * "parar de pedir") nunca é sobrescrito.
 */
export const LoteDominio = z.object({
  empresas: z.array(z.object({
    codi_emp: z.number().int(), nome: z.string(), cnpj: z.string(), email: z.string().nullable(),
    situacao: z.string().nullable(), simples: z.boolean().nullable(), ddd: z.string().nullable(), fone: z.string().nullable(),
  })),
  contatos: z.array(z.object({ codi_emp: z.number().int(), nome: z.string().nullable(), email: z.string().nullable(), telefone: z.string().nullable() })),
  responsaveis: z.array(z.object({ codi_emp: z.number().int(), i_responsavel: z.number().int(), tipo: z.string().nullable() })),
  contas: z.array(z.object({
    codi_emp: z.number().int(), i_conta_caixa: z.number().int(), i_banco: z.number().int().nullable(), agencia: z.string().nullable(),
    identificador: z.string().nullable(), codigo_banco: z.string().nullable(), nome_banco: z.string().nullable(),
  })),
  encerradas: z.array(z.object({ codi_emp: z.number().int(), i_conta_caixa: z.number().int() })).default([]),
  diagnostico: z.record(z.unknown()).optional(),
});
export type LoteDominio = z.infer<typeof LoteDominio>;

/** RESPONSAVEL_TIPO que contam como responsável da folha (vê os sensíveis). Configurável. */
function tiposFolha(): string[] {
  return (process.env.DOMINIO_TIPOS_FOLHA ?? 'F').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
}

/** Situação da Domínio que conta como empresa ativa (stat_emp). */
const ehAtiva = (s: string | null) => !s || ['A', 'ATIVA', '1'].includes(s.toUpperCase());

export async function sincronizarDominio(entrada: unknown) {
  const lote = LoteDominio.parse(entrada);
  return transacao(async (c) => {
    const idPorCodi = new Map<number, string>();
    for (const e of lote.empresas) {
      const r = await c.query<{ id: string }>(
        `INSERT INTO empresas (codi_emp, nome, cnpj, email, situacao, simples, telefone_e164, perfil, ativo, sincronizada_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (codi_emp) DO UPDATE SET nome = EXCLUDED.nome, cnpj = EXCLUDED.cnpj, email = EXCLUDED.email,
           situacao = EXCLUDED.situacao, simples = EXCLUDED.simples, telefone_e164 = EXCLUDED.telefone_e164,
           ativo = EXCLUDED.ativo, sincronizada_em = now()
         RETURNING id`,
        [e.codi_emp, e.nome, e.cnpj.replace(/\D/g, ''), e.email, e.situacao, e.simples, paraE164(e.ddd, e.fone),
          e.simples ? 'simples' : 'presumido', ehAtiva(e.situacao)]);
      idPorCodi.set(e.codi_emp, r.rows[0].id);
    }
    await completarIds(c, idPorCodi, [...lote.contatos, ...lote.responsaveis, ...lote.contas, ...lote.encerradas].map((x) => x.codi_emp));

    // Contatos da Domínio: substitui os da origem 'dominio' das empresas do lote.
    const empresasDoLote = [...new Set(lote.contatos.map((x) => idPorCodi.get(x.codi_emp)).filter(Boolean))] as string[];
    if (empresasDoLote.length) await c.query(`DELETE FROM contatos_empresa WHERE origem = 'dominio' AND empresa_id = ANY($1)`, [empresasDoLote]);
    let contatos = 0;
    for (const ct of lote.contatos) {
      const emp = idPorCodi.get(ct.codi_emp);
      if (!emp) continue;
      await c.query(
        `INSERT INTO contatos_empresa (empresa_id, nome, email, telefone, telefone_e164, origem) VALUES ($1, $2, $3, $4, $5, 'dominio')
         ON CONFLICT (empresa_id, email, telefone) DO NOTHING`,
        [emp, ct.nome, ct.email?.toLowerCase() ?? null, ct.telefone, paraE164(null, ct.telefone)]);
      contatos++;
    }

    // Responsáveis: casa I_RESPONSAVEL com usuarios.i_responsavel_dominio.
    const folha = tiposFolha();
    const usuarios = new Map((await c.query<{ id: string; i: number }>(`SELECT id, i_responsavel_dominio AS i FROM usuarios WHERE i_responsavel_dominio IS NOT NULL AND ativo`)).rows.map((u) => [u.i, u.id]));
    const empresasComResp = [...new Set(lote.responsaveis.map((r) => idPorCodi.get(r.codi_emp)).filter(Boolean))] as string[];
    if (empresasComResp.length) await c.query(`DELETE FROM responsaveis_empresa WHERE origem = 'dominio' AND empresa_id = ANY($1)`, [empresasComResp]);
    const semUsuario = new Set<number>();
    for (const r of lote.responsaveis) {
      const emp = idPorCodi.get(r.codi_emp);
      const usu = usuarios.get(r.i_responsavel);
      if (!emp) continue;
      if (!usu) { semUsuario.add(r.i_responsavel); continue; }
      const papel = r.tipo && folha.includes(r.tipo.toUpperCase()) ? 'folha' : 'geral';
      await c.query(`INSERT INTO responsaveis_empresa (empresa_id, usuario_id, papel, tipo_dominio, origem) VALUES ($1, $2, $3, $4, 'dominio')
                     ON CONFLICT (empresa_id, usuario_id, papel) DO UPDATE SET tipo_dominio = EXCLUDED.tipo_dominio`, [emp, usu, papel, r.tipo]);
    }
    // O responsável principal (quem recebe as pendências) é o primeiro 'geral'.
    await c.query(`
      UPDATE empresas e SET responsavel_id = r.usuario_id
      FROM (SELECT DISTINCT ON (empresa_id) empresa_id, usuario_id FROM responsaveis_empresa WHERE papel = 'geral'
            ORDER BY empresa_id, (origem = 'app') DESC, usuario_id) r
      WHERE r.empresa_id = e.id AND e.id = ANY($1)`, [empresasComResp]);

    // Contas bancárias (subtipos de Extrato).
    let contas = 0;
    for (const ct of lote.contas) {
      const emp = idPorCodi.get(ct.codi_emp);
      if (!emp) continue;
      await c.query(
        `INSERT INTO contas_bancarias (empresa_id, i_conta_caixa, i_banco, codigo_banco, nome_banco, agencia, identificador_conta, final)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (empresa_id, i_conta_caixa) DO UPDATE SET i_banco = EXCLUDED.i_banco, codigo_banco = EXCLUDED.codigo_banco,
           nome_banco = EXCLUDED.nome_banco, agencia = EXCLUDED.agencia, identificador_conta = EXCLUDED.identificador_conta, final = EXCLUDED.final`,
        [emp, ct.i_conta_caixa, ct.i_banco, ct.codigo_banco ? ct.codigo_banco.padStart(3, '0') : null, ct.nome_banco, ct.agencia, ct.identificador, final4(ct.identificador ?? '')]);
      contas++;
    }

    // Conta encerrada na Domínio: só gera a SUGESTÃO "Parar de pedir?". Quem confirma é o funcionário.
    let sugestoes = 0;
    for (const enc of lote.encerradas) {
      const emp = idPorCodi.get(enc.codi_emp);
      if (!emp) continue;
      const r = await c.query(
        `UPDATE contas_bancarias SET situacao = 'encerrada', sugestao_encerrada_em = coalesce(sugestao_encerrada_em, now())
         WHERE empresa_id = $1 AND i_conta_caixa = $2 AND situacao = 'ativa'`, [emp, enc.i_conta_caixa]);
      sugestoes += r.rowCount ?? 0;
    }

    await aoSincronizarContas(c);

    const resumo = { empresas: lote.empresas.length, contatos, responsaveis: lote.responsaveis.length, contas, sugestoesEncerradas: sugestoes, responsaveisSemUsuario: [...semUsuario] };
    await c.query(`INSERT INTO leitor_execucoes (empresas, contatos, contas, diagnostico, origem) VALUES ($1, $2, $3, $4, 'leitor')`,
      [lote.empresas.length, contatos, contas, lote.diagnostico ? JSON.stringify(lote.diagnostico) : null]);
    return resumo;
  });
}

/** Empresas que vieram só nas outras listas (sincronização parcial): busca o id pelo codi_emp. */
async function completarIds(c: PoolClient, mapa: Map<number, string>, codis: number[]) {
  const faltam = [...new Set(codis.filter((x) => !mapa.has(x)))];
  if (!faltam.length) return;
  const r = await c.query<{ id: string; codi_emp: number }>(`SELECT id, codi_emp FROM empresas WHERE codi_emp = ANY($1)`, [faltam]);
  for (const l of r.rows) mapa.set(l.codi_emp, l.id);
}
