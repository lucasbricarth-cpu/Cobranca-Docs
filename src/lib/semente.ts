import type { Pool } from 'pg';

/** Semente de demonstração. Usada por `npm run semear` e pelos testes. */
export async function semear(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const admin = (await c.query(
      `INSERT INTO usuarios (nome, email, papel, i_responsavel_dominio, responsavel_folha) VALUES ('Ana Lima', 'ana@escritorio.com.br', 'admin', 1, true)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`)).rows[0].id as string;
    const func = (await c.query(
      `INSERT INTO usuarios (nome, email, papel, i_responsavel_dominio) VALUES ('Bruno Costa', 'bruno@escritorio.com.br', 'funcionario', 2)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`)).rows[0].id as string;
    const empresas = [
      { codi: 101, nome: 'Padaria do Bairro Ltda', cnpj: '11222333000181', resp: admin, perfil: 'simples', folha: true },
      { codi: 102, nome: 'Oficina Mecânica Silva ME', cnpj: '45723174000110', resp: func, perfil: 'simples', folha: false },
      { codi: 103, nome: 'Consultório Dra. Souza', cnpj: '07526557000100', resp: admin, perfil: 'presumido', folha: true },
    ];
    const ids: Record<number, string> = {};
    for (const e of empresas) {
      ids[e.codi] = (await c.query(
        `INSERT INTO empresas (codi_emp, nome, cnpj, responsavel_id, perfil, tem_folha, situacao, simples, sincronizada_em)
         VALUES ($1, $2, $3, $4, $5, $6, 'A', true, now())
         ON CONFLICT (codi_emp) DO UPDATE SET nome = EXCLUDED.nome, responsavel_id = EXCLUDED.responsavel_id RETURNING id`,
        [e.codi, e.nome, e.cnpj, e.resp, e.perfil, e.folha])).rows[0].id;
    }
    const contas = [
      [101, 1, 341, 'ITAU UNIBANCO S.A.', '0912', '45567', '0567'],
      [101, 2, 748, 'BANCO COOPERATIVO SICREDI S.A.', '0710', '120921', '0921'],
      [102, 3, 1, 'BANCO DO BRASIL S.A.', '1234', '981200', '1200'],
      [103, 4, 341, 'ITAU UNIBANCO S.A.', '0033', '77310', '7310'],
    ] as const;
    for (const [codi, icc, ib, nome, ag, ident, fin] of contas) {
      await c.query(
        `INSERT INTO contas_bancarias (empresa_id, i_conta_caixa, i_banco, codigo_banco, nome_banco, agencia, identificador_conta, final)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (empresa_id, i_conta_caixa) DO NOTHING`,
        [ids[codi], icc, ib, String(ib).padStart(3, '0'), nome, ag, ident, fin]);
    }
    const login = (await c.query(
      `INSERT INTO logins_cliente (nome, email, convidado_por) VALUES ('Carlos Padeiro', 'carlos@padaria.com.br', $1)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`, [admin])).rows[0].id as string;
    const login2 = (await c.query(
      `INSERT INTO logins_cliente (nome, email, convidado_por) VALUES ('Dona Silva', 'silva@oficina.com.br', $1)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`, [admin])).rows[0].id as string;
    await c.query(`INSERT INTO vinculos_login_empresa (login_id, empresa_id) VALUES ($1, $2), ($1, $3), ($4, $5) ON CONFLICT DO NOTHING`,
      [login, ids[101], ids[103], login2, ids[102]]);
    await c.query(`INSERT INTO contatos_empresa (empresa_id, nome, email, telefone, telefone_e164) VALUES ($1, 'Carlos', 'carlos@padaria.com.br', '(11) 98888-7777', '5511988887777') ON CONFLICT DO NOTHING`, [ids[101]]);
    await c.query('COMMIT');
    return { admin, func, login, login2, empresas: ids };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
