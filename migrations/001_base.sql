-- 001 — base: funcionários, empresas (da Domínio), contatos, contas, logins de cliente, sessões.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Funcionários do escritório. A estética (paleta, fundo, tema) é por usuário.
CREATE TABLE usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  papel       TEXT NOT NULL CHECK (papel IN ('admin', 'funcionario')),
  -- Id do responsável na Domínio (PCRESPONSAVEL_EMPRESA.I_RESPONSAVEL), para casar as empresas.
  i_responsavel_dominio INTEGER,
  -- Responsável pela folha: vê os tipos sensíveis das empresas dele.
  responsavel_folha BOOLEAN NOT NULL DEFAULT false,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  estetica    JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Empresas, sincronizadas pelo leitor da Domínio (geempre). Só leitura lá; aqui é cópia.
CREATE TABLE empresas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codi_emp      INTEGER UNIQUE,              -- geempre.codi_emp
  nome          TEXT NOT NULL,               -- geempre.nome_emp
  cnpj          TEXT NOT NULL,               -- geempre.cgce_emp (só dígitos)
  email         TEXT,                        -- geempre.email_emp
  situacao      TEXT,                        -- geempre.stat_emp
  simples       BOOLEAN,                     -- geempre.simples_emp
  -- Perfil para a agenda: simples, presumido, mei, folha (editável pelo escritório).
  perfil        TEXT NOT NULL DEFAULT 'simples',
  tem_folha     BOOLEAN NOT NULL DEFAULT false,
  responsavel_id UUID REFERENCES usuarios(id),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  sincronizada_em TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX empresas_cnpj ON empresas (cnpj);
CREATE INDEX empresas_responsavel ON empresas (responsavel_id);

-- Contatos vindos da Domínio (GEEMPRE_CONTATO) ou cadastrados no app. São sugestão de convite.
CREATE TABLE contatos_empresa (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome       TEXT,
  email      TEXT,
  telefone   TEXT,          -- como veio
  telefone_e164 TEXT,       -- 55DDDNUMERO, sugestão
  origem     TEXT NOT NULL DEFAULT 'dominio' CHECK (origem IN ('dominio', 'app')),
  UNIQUE (empresa_id, email, telefone)
);

-- Contas bancárias por empresa (CTCONTACAIXA_CONTA_BANCARIA + CTLISTA_BANCOS_BANCO_CENTRAL).
CREATE TABLE contas_bancarias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  i_conta_caixa INTEGER,
  i_banco       INTEGER,
  codigo_banco  TEXT,          -- CODIGO_BANCO (ex.: 341)
  nome_banco    TEXT,          -- DESCRICAO_BANCO
  agencia       TEXT,
  identificador_conta TEXT,    -- número da conta como veio
  final         TEXT NOT NULL, -- 4 últimos dígitos: "final 0567"
  situacao      TEXT NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa', 'encerrada')),
  -- O app nunca desativa sozinho: a situação da Domínio só gera a sugestão.
  pedir         BOOLEAN NOT NULL DEFAULT true,
  sugestao_encerrada_em TIMESTAMPTZ,
  UNIQUE (empresa_id, i_conta_caixa)
);

-- Logins dos clientes: nascem por convite, ligados a uma ou mais empresas.
CREATE TABLE logins_cliente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  convidado_por UUID REFERENCES usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  desativado_em TIMESTAMPTZ
);
CREATE TABLE vinculos_login_empresa (
  login_id   UUID NOT NULL REFERENCES logins_cliente(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  PRIMARY KEY (login_id, empresa_id)
);

-- Sessões (funcionário ou cliente). O cookie leva o token; aqui fica só o hash.
CREATE TABLE sessoes (
  token_hash  TEXT PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('funcionario', 'cliente')),
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  login_id    UUID REFERENCES logins_cliente(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em   TIMESTAMPTZ NOT NULL,
  user_agent  TEXT,
  CHECK ((tipo = 'funcionario' AND usuario_id IS NOT NULL) OR (tipo = 'cliente' AND login_id IS NOT NULL))
);
CREATE INDEX sessoes_expira ON sessoes (expira_em);

-- Links mágicos (entrada por e-mail), de uso único.
CREATE TABLE links_magicos (
  token_hash  TEXT PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('funcionario', 'cliente')),
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  login_id    UUID REFERENCES logins_cliente(id) ON DELETE CASCADE,
  -- Destino opcional depois de entrar (ex.: o item do pedido).
  destino     TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em   TIMESTAMPTZ NOT NULL,
  usado_em    TIMESTAMPTZ
);

-- Passkeys (WebAuthn), para funcionário e cliente.
CREATE TABLE passkeys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL CHECK (tipo IN ('funcionario', 'cliente')),
  usuario_id    UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  login_id      UUID REFERENCES logins_cliente(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,   -- base64url
  public_key    BYTEA NOT NULL,
  counter       BIGINT NOT NULL DEFAULT 0,
  transports    TEXT[],
  apelido       TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_em      TIMESTAMPTZ
);
-- Desafios do WebAuthn pendentes (curta duração).
CREATE TABLE desafios_webauthn (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio    TEXT NOT NULL,
  tipo       TEXT NOT NULL,
  usuario_id UUID,
  login_id   UUID,
  email      TEXT,
  expira_em  TIMESTAMPTZ NOT NULL
);

-- Execuções do leitor da Domínio.
CREATE TABLE leitor_execucoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  empresas    INTEGER NOT NULL DEFAULT 0,
  contatos    INTEGER NOT NULL DEFAULT 0,
  contas      INTEGER NOT NULL DEFAULT 0,
  diagnostico JSONB,
  erro        TEXT
);
