# Leitor da Domínio

Programa local, no servidor do escritório. Lê o banco da Domínio **só com SELECT** e envia ao app, de dentro para fora. O app na nuvem nunca se conecta à Domínio.

## Antes de instalar

1. **Confirme com a Thomson Reuters que a licença permite esse acesso de leitura.** Sem essa confirmação, não instale.
2. Peça ao DBA para rodar `sql/criar-usuario-leitura.sql`. Ele cria o usuário `leitor_portal` com `GRANT SELECT` só nas tabelas listadas.
3. Confirme na Domínio a ligação entre `CTCONTACAIXA_CONTA_BANCARIA.I_CONTA_CAIXA` e `ctcontas.codi_cta`. Só depois preencha `DOMINIO_SQL_ENCERRADAS`.

## Instalar e rodar

```bash
cp .env.example .env     # conexão ODBC, URL do app e token
npm install
npm run testar-conexao
npm run diagnostico      # na primeira vez: diz se o escritório já usa Onvio e Processos
npm run sincronizar      # agende pelo menos uma vez por dia (Agendador de Tarefas do Windows ou cron)
```

## O que é lido

| Dado | Tabela e campos |
|---|---|
| Empresas | `geempre`: codi_emp, nome_emp, cgce_emp, email_emp, stat_emp, simples_emp, dddf_emp, fone_emp |
| Contatos | `GEEMPRE_CONTATO`: CODI_EMP, NOME_CONTATO, EMAIL_CONTATO, TELEFONE_CONTATO |
| Responsáveis | `PCRESPONSAVEL_EMPRESA`: CODI_EMP, I_RESPONSAVEL, RESPONSAVEL_TIPO |
| Contas | `CTCONTACAIXA_CONTA_BANCARIA` + `CTLISTA_BANCOS_BANCO_CENTRAL` |
| Conta encerrada | `ctcontas.SITUACAO_CTA` (só depois de confirmar a ligação) |
| Diagnóstico, uma vez | contagens em `GEEMPRESAS_MODULOWEB`, `GEATENDIMENTO_PUBLICAR_DOCUMENTOS`, `PCVINCULO_PROCESSO` |

Nada de folha, salários nem lançamentos.

## Duas travas contra escrita

- **No programa:** `src/trava.ts` recusa tudo que não for um `SELECT` único nas tabelas da lista.
- **No banco:** o usuário `leitor_portal` só tem `SELECT`. Um `INSERT`, `UPDATE` ou `DELETE` falha por permissão.

Os testes do app (`tests/leitor-dominio.test.ts`) provam as duas, com a Domínio simulada em Postgres (`sql/dominio-simulado.sql`).
