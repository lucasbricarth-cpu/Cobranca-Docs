-- Domínio SIMULADA em Postgres, só para os testes do leitor.
-- Mesmas tabelas e colunas que o leitor lê, com um usuário só de leitura.
DROP SCHEMA IF EXISTS dominio CASCADE;
CREATE SCHEMA dominio;
SET search_path = dominio;

CREATE TABLE geempre (codi_emp INTEGER PRIMARY KEY, nome_emp TEXT, cgce_emp TEXT, email_emp TEXT, stat_emp TEXT, simples_emp TEXT, dddf_emp TEXT, fone_emp TEXT);
CREATE TABLE geempre_contato (codi_emp INTEGER, nome_contato TEXT, email_contato TEXT, telefone_contato TEXT);
CREATE TABLE pcresponsavel_empresa (codi_emp INTEGER, i_responsavel INTEGER, responsavel_tipo TEXT);
CREATE TABLE ctcontacaixa_conta_bancaria (codi_emp INTEGER, i_conta_caixa INTEGER, i_banco INTEGER, agencia TEXT, identificador_conta TEXT);
CREATE TABLE ctlista_bancos_banco_central (i_banco INTEGER PRIMARY KEY, codigo_banco TEXT, descricao_banco TEXT);
CREATE TABLE ctcontas (codi_emp INTEGER, codi_cta INTEGER, situacao_cta TEXT);
CREATE TABLE geempresas_moduloweb (codi_emp INTEGER, usa_dominio_web TEXT);
CREATE TABLE geatendimento_publicar_documentos (codi_emp INTEGER, data_publicado DATE);
CREATE TABLE pcvinculo_processo (codi_emp INTEGER);
-- Tabela FORA da lista do leitor (folha): o usuário de leitura não pode nem ler.
CREATE TABLE fofolha (codi_emp INTEGER, salario NUMERIC);

INSERT INTO geempre VALUES
  (101, 'Padaria do Bairro Ltda', '11.222.333/0001-81', 'contato@padaria.com.br', 'A', 'S', '11', '988887777'),
  (102, 'Oficina Mecânica Silva ME', '45.723.174/0001-10', NULL, 'A', 'S', '11', '33334444'),
  (104, 'Mercadinho Novo', '19.131.243/0001-97', 'mercadinho@ex.com', 'A', 'N', NULL, NULL);
INSERT INTO geempre_contato VALUES (101, 'Carlos', 'carlos@padaria.com.br', '(11) 98888-7777'), (104, 'Rita', 'rita@ex.com', '11 97777-6666');
INSERT INTO pcresponsavel_empresa VALUES (101, 1, 'C'), (101, 2, 'F'), (102, 2, 'C'), (104, 1, 'C');
INSERT INTO ctlista_bancos_banco_central VALUES (1, '341', 'ITAU UNIBANCO S.A.'), (2, '748', 'BANCO COOPERATIVO SICREDI S.A.'), (3, '001', 'BANCO DO BRASIL S.A.');
INSERT INTO ctcontacaixa_conta_bancaria VALUES (101, 1, 1, '0912', '45567-0'), (101, 2, 2, '0710', '12092-1'), (104, 9, 3, '1111', '3310-X');
INSERT INTO ctcontas VALUES (101, 2, 'I');
INSERT INTO geempresas_moduloweb VALUES (101, 'S'), (102, 'N');
INSERT INTO geatendimento_publicar_documentos VALUES (101, '2026-08-10');
INSERT INTO fofolha VALUES (101, 3500);

-- Usuário só de leitura, nas tabelas do leitor.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dominio_leitor') THEN
    CREATE ROLE dominio_leitor LOGIN PASSWORD 'leitor';
  END IF;
END $$;
ALTER ROLE dominio_leitor SET search_path = dominio;
GRANT USAGE ON SCHEMA dominio TO dominio_leitor;
GRANT SELECT ON geempre, geempre_contato, pcresponsavel_empresa, ctcontacaixa_conta_bancaria,
  ctlista_bancos_banco_central, ctcontas, geempresas_moduloweb, geatendimento_publicar_documentos,
  pcvinculo_processo TO dominio_leitor;
