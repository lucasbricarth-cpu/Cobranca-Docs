-- 003 — tipos, subtipos, documentos, itens de pedido, auditoria, acessos e fila de trabalho.

-- Tipos de documento, cadastrados pelo escritório.
CREATE TABLE tipos_documento (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  -- de onde vêm os subtipos: contas (extrato, do leitor da Domínio), cartoes (fatura, cadastrada no app),
  -- livre (criados pelo escritório) ou NULL (sem subtipo).
  subtipo_origem TEXT CHECK (subtipo_origem IN ('contas', 'cartoes', 'livre')),
  -- Regra de mês para envio SEM pedido: o mês anterior ao envio ou o mês do envio.
  regra_mes     TEXT NOT NULL DEFAULT 'anterior' CHECK (regra_mes IN ('anterior', 'atual')),
  sensivel      BOOLEAN NOT NULL DEFAULT false,
  guarda_meses  INTEGER NOT NULL DEFAULT 60,
  icone         TEXT NOT NULL DEFAULT 'file-text',
  ordem         INTEGER NOT NULL DEFAULT 100,
  -- Arquivamento automático (Etapa 6): começa DESLIGADO; o Admin liga por tipo.
  arquivamento_automatico BOOLEAN NOT NULL DEFAULT false,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tipos_nome ON tipos_documento (lower(nome));

-- Subtipos, por empresa. A pasta usa o ID do subtipo, nunca o nome: renomear não quebra o histórico.
CREATE TABLE subtipos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo_id           UUID NOT NULL REFERENCES tipos_documento(id),
  nome              TEXT,                      -- subtipos livres (e apelido opcional)
  conta_bancaria_id UUID REFERENCES contas_bancarias(id) ON DELETE SET NULL,  -- extrato
  cartao_final      TEXT CHECK (cartao_final ~ '^[0-9]{4}$'),                  -- fatura: só os 4 últimos dígitos
  cartao_emissor    TEXT,                      -- ex.: Itaú, Nubank (texto livre do escritório)
  ativo             BOOLEAN NOT NULL DEFAULT true,   -- "pedir" (o funcionário pode parar de pedir)
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_id, conta_bancaria_id)
);
CREATE INDEX subtipos_empresa ON subtipos (empresa_id, tipo_id);
CREATE UNIQUE INDEX subtipos_cartao ON subtipos (empresa_id, tipo_id, cartao_final) WHERE cartao_final IS NOT NULL;

-- Pedidos (Etapa 4 cria e agenda; a tabela nasce aqui porque os itens apontam para ela).
CREATE TABLE pedidos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem      TEXT NOT NULL CHECK (origem IN ('avulso', 'agenda')),
  modelo_id   UUID,
  mensagem    TEXT,
  criado_por  UUID REFERENCES usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens de pedido: UM por empresa, tipo, subtipo e competência (restrição única).
-- É o que permite "2 de 3 extratos recebidos" e lembrar só do que falta.
CREATE TABLE itens_pedido (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo_id      UUID NOT NULL REFERENCES tipos_documento(id),
  subtipo_id   UUID REFERENCES subtipos(id),
  competencia  DATE NOT NULL CHECK (extract(day FROM competencia) = 1),
  prazo        DATE,
  -- pendente → recebido (a conferir) → conferido; refazer = o escritório recusou e pediu de novo.
  status       TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'conferido', 'refazer', 'cancelado')),
  documento_id UUID,                 -- o arquivo atual do item (os anteriores ficam Substituídos)
  motivo_refazer TEXT,
  mensagem     TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recebido_em  TIMESTAMPTZ,
  conferido_em TIMESTAMPTZ,
  CONSTRAINT um_item_por_competencia UNIQUE NULLS NOT DISTINCT (empresa_id, tipo_id, subtipo_id, competencia)
);
CREATE INDEX itens_empresa_comp ON itens_pedido (empresa_id, competencia);
CREATE INDEX itens_abertos ON itens_pedido (status, prazo) WHERE status IN ('pendente', 'refazer');

-- Documentos (arquivos). Tipo, subtipo e mês são CAMPOS do registro, não pastas.
-- "Não reconhecido" e "A conferir" são STATUS, não lugares.
CREATE TABLE documentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID REFERENCES empresas(id),            -- NULL = pasta geral de Não reconhecidos
  tipo_id         UUID REFERENCES tipos_documento(id),
  subtipo_id      UUID REFERENCES subtipos(id),
  competencia     DATE CHECK (competencia IS NULL OR extract(day FROM competencia) = 1),
  item_id         UUID REFERENCES itens_pedido(id) ON DELETE SET NULL,
  com_pedido      BOOLEAN NOT NULL DEFAULT false,
  -- Sensível: pelo tipo OU porque o cliente respondeu "sim" a "É documento de saúde de funcionário?".
  -- Sensível nunca vai para a IA e não tem miniatura.
  sensivel        BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'processando' CHECK (status IN (
                    'processando',      -- na fila do antivírus / miniatura / classificação
                    'a_conferir',       -- com sugestão de tipo, espera o funcionário
                    'nao_reconhecido',  -- sem tipo identificado, ou sem empresa
                    'conferido',
                    'rejeitado',        -- "Refazer": o escritório recusou e pediu de novo
                    'substituido',      -- veio um arquivo novo para o mesmo item
                    'recusado'          -- vírus, tipo proibido, PDF com JavaScript (nunca aparece na pasta)
                  )),
  nome_original   TEXT NOT NULL,
  mime            TEXT NOT NULL,
  extensao        TEXT NOT NULL,
  tamanho         BIGINT NOT NULL,
  hash_sha256     TEXT NOT NULL,
  chave           TEXT NOT NULL,          -- chave no armazenamento
  miniatura_chave TEXT,                   -- primeira página (nunca nos tipos sensíveis)
  paginas         INTEGER,
  origem          TEXT NOT NULL CHECK (origem IN ('app', 'whatsapp', 'escritorio')),
  enviado_por_login UUID REFERENCES logins_cliente(id),
  enviado_por_usuario UUID REFERENCES usuarios(id),
  whatsapp_numero TEXT,
  recebido_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  conferido_em    TIMESTAMPTZ,
  conferido_por   UUID REFERENCES usuarios(id),
  motivo_rejeicao TEXT,
  substituido_por UUID REFERENCES documentos(id),
  sugestao        JSONB,                  -- o que a classificação sugeriu (Etapa 6)
  cnpjs_lidos     TEXT[],
  motivo_recusa   TEXT,
  excluido_em     TIMESTAMPTZ,            -- só depois da aprovação de um Admin (Etapa 9)
  excluido_por    UUID REFERENCES usuarios(id)
);
ALTER TABLE itens_pedido ADD CONSTRAINT itens_documento_fk FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE SET NULL;
CREATE INDEX documentos_empresa ON documentos (empresa_id, tipo_id, competencia) WHERE excluido_em IS NULL;
CREATE INDEX documentos_status ON documentos (status) WHERE excluido_em IS NULL;
-- O mesmo arquivo (mesmo hash) na mesma empresa não vira dois documentos.
CREATE UNIQUE INDEX documentos_hash_empresa ON documentos (empresa_id, hash_sha256)
  WHERE excluido_em IS NULL AND empresa_id IS NOT NULL AND status NOT IN ('recusado');
CREATE UNIQUE INDEX documentos_hash_sem_empresa ON documentos (hash_sha256)
  WHERE excluido_em IS NULL AND empresa_id IS NULL AND status NOT IN ('recusado');

-- Auditoria: toda troca de empresa, tipo, subtipo ou mês (e conferência/rejeição), com quem, de quê para quê e quando.
CREATE TABLE auditoria_documentos (
  id           BIGSERIAL PRIMARY KEY,
  documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  acao         TEXT NOT NULL,
  de           JSONB,
  para         JSONB,
  usuario_id   UUID REFERENCES usuarios(id),
  login_id     UUID REFERENCES logins_cliente(id),
  quem         TEXT NOT NULL,             -- nome no momento (o registro sobrevive a renomes)
  em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_doc ON auditoria_documentos (documento_id, em);

-- Registro de acesso: quem abriu ou baixou cada arquivo, e quando (Etapa 9 usa).
CREATE TABLE acessos_documento (
  id           BIGSERIAL PRIMARY KEY,
  documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  acao         TEXT NOT NULL CHECK (acao IN ('abrir', 'baixar', 'miniatura', 'exportar')),
  usuario_id   UUID REFERENCES usuarios(id),
  login_id     UUID REFERENCES logins_cliente(id),
  em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX acessos_doc ON acessos_documento (documento_id, em);

-- Fila de trabalho (antivírus, miniatura, classificação, avisos, WhatsApp).
CREATE TABLE fila (
  id          BIGSERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL,
  dados       JSONB NOT NULL DEFAULT '{}',
  chave       TEXT UNIQUE,                -- evita a mesma tarefa duas vezes
  executar_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  tentativas  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'rodando', 'feito', 'falhou')),
  erro        TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  feito_em    TIMESTAMPTZ
);
CREATE INDEX fila_pendente ON fila (executar_em) WHERE status = 'pendente';

-- Uploads em andamento (URL assinada de curta duração).
CREATE TABLE uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       TEXT NOT NULL,
  login_id    UUID REFERENCES logins_cliente(id),
  usuario_id  UUID REFERENCES usuarios(id),
  tamanho_max BIGINT NOT NULL,
  expira_em   TIMESTAMPTZ NOT NULL,
  usado_em    TIMESTAMPTZ
);

-- Tipos padrão (o escritório edita em Ajustes › Tipos).
INSERT INTO tipos_documento (nome, subtipo_origem, regra_mes, sensivel, guarda_meses, icone, ordem) VALUES
  ('Extrato bancário',            'contas',  'anterior', false, 60, 'landmark',      10),
  ('Fatura de cartão',            'cartoes', 'anterior', false, 60, 'credit-card',   20),
  ('Notas fiscais de entrada',    NULL,      'anterior', false, 60, 'receipt',       30),
  ('Notas fiscais de saída',      NULL,      'anterior', false, 60, 'receipt-text',  40),
  ('Guias e comprovantes',        'livre',   'atual',    false, 60, 'banknote',      50),
  ('Folha: ponto e eventos',      NULL,      'anterior', false, 60, 'clock',         60),
  ('Atestados e exames de funcionário', NULL, 'atual',   true,  240, 'heart-pulse',  70),
  ('Contribuição sindical',       NULL,      'atual',    true,  60, 'users',         80),
  ('Contratos e alterações',      NULL,      'atual',    false, 600, 'scroll-text',  90),
  ('Outros',                      'livre',   'atual',    false, 60, 'file-text',    100);

-- Avisos enviados (Etapa 7): cada aviso sai UMA vez por item, canal, etapa e destinatário,
-- e fica registrado como prova da cobrança.
CREATE TABLE avisos (
  id           BIGSERIAL PRIMARY KEY,
  item_id      UUID REFERENCES itens_pedido(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES documentos(id) ON DELETE CASCADE,
  login_id     UUID REFERENCES logins_cliente(id),
  usuario_id   UUID REFERENCES usuarios(id),
  canal        TEXT NOT NULL CHECK (canal IN ('push', 'email', 'whatsapp')),
  etapa        TEXT NOT NULL,
  destino      TEXT,
  texto        TEXT,
  status       TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'falhou', 'sem_destino', 'sem_aceite')),
  erro         TEXT,
  enviado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aviso_unico UNIQUE NULLS NOT DISTINCT (item_id, documento_id, canal, etapa, login_id, usuario_id)
);
CREATE INDEX avisos_item ON avisos (item_id, enviado_em);

CREATE EXTENSION IF NOT EXISTS unaccent;
