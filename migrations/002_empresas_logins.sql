-- 002 — responsáveis por empresa (vindos da Domínio) e ajustes de logins.

-- Um registro por responsável da Domínio (PCRESPONSAVEL_EMPRESA). O papel
-- 'folha' dá acesso aos tipos sensíveis daquela empresa.
CREATE TABLE responsaveis_empresa (
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  papel      TEXT NOT NULL CHECK (papel IN ('geral', 'folha')),
  tipo_dominio TEXT,                 -- RESPONSAVEL_TIPO como veio
  origem     TEXT NOT NULL DEFAULT 'dominio' CHECK (origem IN ('dominio', 'app')),
  PRIMARY KEY (empresa_id, usuario_id, papel)
);

-- O responsável da folha deixa de ser uma marca global do usuário: é por empresa.
ALTER TABLE usuarios DROP COLUMN responsavel_folha;

-- Telefones da Domínio (geempre.dddf_emp + fone_emp) como sugestão.
ALTER TABLE empresas ADD COLUMN telefone_e164 TEXT;

-- Último diagnóstico do leitor: uma vez só, para saber se o escritório usa Onvio/Processos.
ALTER TABLE leitor_execucoes ADD COLUMN origem TEXT;

CREATE INDEX vinculos_empresa ON vinculos_login_empresa (empresa_id);

-- Assinaturas de Web Push (VAPID), por aparelho, de funcionário ou cliente.
CREATE TABLE push_assinaturas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  login_id   UUID REFERENCES logins_cliente(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  falhou_em  TIMESTAMPTZ,
  CHECK (usuario_id IS NOT NULL OR login_id IS NOT NULL)
);
