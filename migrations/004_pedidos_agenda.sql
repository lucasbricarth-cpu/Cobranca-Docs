-- 004 — pedidos avulsos e agenda mensal.

ALTER TABLE pedidos
  ADD COLUMN tipo_id UUID REFERENCES tipos_documento(id),
  ADD COLUMN competencia DATE,
  ADD COLUMN prazo DATE,
  ADD COLUMN todas_as_contas BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX pedidos_criado ON pedidos (criado_em DESC);

-- Modelos de pedidos recorrentes por perfil de empresa (Simples, Presumido, MEI, com folha).
CREATE TABLE modelos_agenda (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil      TEXT NOT NULL CHECK (perfil IN ('simples', 'presumido', 'mei', 'folha')),
  tipo_id     UUID NOT NULL REFERENCES tipos_documento(id),
  dia_criacao SMALLINT NOT NULL CHECK (dia_criacao BETWEEN 1 AND 31),  -- dia do mês em que o pedido nasce
  dia_prazo   SMALLINT NOT NULL CHECK (dia_prazo BETWEEN 1 AND 31),    -- dia do prazo (se menor que o de criação, no mês seguinte)
  meses_competencia SMALLINT NOT NULL DEFAULT -1,                    -- -1 = mês anterior ao pedido; 0 = o próprio mês
  mensagem    TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (perfil, tipo_id)
);

-- Ajuste por empresa: desligar um modelo, ou mudar os dias, só para ela.
CREATE TABLE agenda_empresa (
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  modelo_id   UUID NOT NULL REFERENCES modelos_agenda(id) ON DELETE CASCADE,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  dia_criacao SMALLINT CHECK (dia_criacao BETWEEN 1 AND 31),
  dia_prazo   SMALLINT CHECK (dia_prazo BETWEEN 1 AND 31),
  PRIMARY KEY (empresa_id, modelo_id)
);

-- Execuções dos jobs (uma linha por dia), para acompanhar e para não rodar duas vezes por engano.
CREATE TABLE execucoes_job (
  nome       TEXT NOT NULL,
  dia        DATE NOT NULL,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminado_em TIMESTAMPTZ,
  resumo     JSONB,
  PRIMARY KEY (nome, dia)
);

-- Modelos padrão (o escritório edita em Agenda).
INSERT INTO modelos_agenda (perfil, tipo_id, dia_criacao, dia_prazo, meses_competencia)
SELECT p.perfil, t.id, p.dc, p.dp, p.mc FROM (VALUES
  ('simples',   'Extrato bancário',         1, 5, -1),
  ('simples',   'Fatura de cartão',         1, 10, -1),
  ('simples',   'Notas fiscais de entrada', 1, 5, -1),
  ('simples',   'Notas fiscais de saída',   1, 5, -1),
  ('presumido', 'Extrato bancário',         1, 5, -1),
  ('presumido', 'Fatura de cartão',         1, 10, -1),
  ('presumido', 'Notas fiscais de entrada', 1, 5, -1),
  ('presumido', 'Notas fiscais de saída',   1, 5, -1),
  ('presumido', 'Guias e comprovantes',     1, 10, -1),
  ('mei',       'Extrato bancário',         1, 10, -1),
  ('folha',     'Folha: ponto e eventos',   20, 25, 0)
) AS p(perfil, tipo, dc, dp, mc) JOIN tipos_documento t ON t.nome = p.tipo;
