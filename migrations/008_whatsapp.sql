-- 008 — WhatsApp: vínculo de número por login, aceite (opt-in), mensagens recebidas, lotes e conversas.

-- O vínculo entre um número e um login só vale depois que um FUNCIONÁRIO confirma.
-- Os telefones da Domínio são só sugestão. Desativar o login desliga o vínculo na hora.
CREATE TABLE numeros_whatsapp (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id       UUID NOT NULL REFERENCES logins_cliente(id) ON DELETE CASCADE,
  numero         TEXT NOT NULL CHECK (numero ~ '^55[0-9]{10,11}$'),
  confirmado_por UUID NOT NULL REFERENCES usuarios(id),
  confirmado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ativo          BOOLEAN NOT NULL DEFAULT true,
  desligado_em   TIMESTAMPTZ
);
CREATE UNIQUE INDEX numeros_ativos ON numeros_whatsapp (numero) WHERE ativo;

-- Aceite (opt-in) por contato: data e canal. Sem aceite, nada automático sai pelo WhatsApp.
CREATE TABLE aceites_whatsapp (
  login_id      UUID PRIMARY KEY REFERENCES logins_cliente(id) ON DELETE CASCADE,
  aceito_em     TIMESTAMPTZ NOT NULL,
  canal         TEXT NOT NULL CHECK (canal IN ('whatsapp', 'app', 'email', 'presencial', 'telefone', 'contrato')),
  registrado_por UUID REFERENCES usuarios(id),
  revogado_em   TIMESTAMPTZ
);

-- Toda mensagem recebida, pelo id da plataforma: aviso repetido não vira dois documentos.
CREATE TABLE whatsapp_recebidas (
  id           TEXT PRIMARY KEY,
  numero       TEXT NOT NULL,
  tipo         TEXT NOT NULL,           -- arquivo, texto, botao, outro
  payload      JSONB NOT NULL,
  recebida_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  documento_id UUID REFERENCES documentos(id) ON DELETE SET NULL
);

-- Lote: arquivos seguidos de um número; responde uma vez só, ~30 s depois do último.
CREATE TABLE whatsapp_lotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         TEXT NOT NULL,
  login_id       UUID REFERENCES logins_cliente(id),
  documentos     UUID[] NOT NULL DEFAULT '{}',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_arquivo TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_em     TIMESTAMPTZ
);
CREATE UNIQUE INDEX lote_aberto ON whatsapp_lotes (numero) WHERE fechado_em IS NULL;

-- Conversa: a pergunta em aberto para aquele número (empresa, mês ou resultado).
CREATE TABLE whatsapp_conversas (
  numero      TEXT PRIMARY KEY,
  lote_id     UUID REFERENCES whatsapp_lotes(id) ON DELETE CASCADE,
  etapa       TEXT NOT NULL CHECK (etapa IN ('empresa', 'mes', 'resultado')),
  contexto    JSONB NOT NULL DEFAULT '{}',
  perguntado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em   TIMESTAMPTZ NOT NULL
);

-- Mensagens que o app mandou (registro, e o que o adaptador simulado "envia").
CREATE TABLE whatsapp_enviadas (
  id        BIGSERIAL PRIMARY KEY,
  numero    TEXT NOT NULL,
  tipo      TEXT NOT NULL,              -- modelo, botoes, texto, nota
  conteudo  JSONB NOT NULL,
  enviada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX enviadas_numero ON whatsapp_enviadas (numero, enviada_em);
