-- 009 — guarda, saída de cliente e registro de acesso (Etapa 9).
-- O app nunca apaga sozinho: o job só LISTA o que venceu; a exclusão é aprovada por um Admin.

-- Cada exclusão aprovada: o quê, por quê e quem aprovou.
CREATE TABLE exclusoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motivo       TEXT NOT NULL CHECK (motivo IN ('guarda', 'pasta_geral', 'saida_cliente')),
  empresa_id   UUID REFERENCES empresas(id),
  documentos   UUID[] NOT NULL,
  quantidade   INTEGER NOT NULL,
  aprovado_por UUID NOT NULL REFERENCES usuarios(id),
  aprovado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exclusoes_em ON exclusoes (aprovado_em DESC);

-- "Exportar tudo" de uma empresa (ZIP com a árvore de pastas). A exclusão da saída exige uma exportação concluída.
CREATE TABLE exportacoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES empresas(id),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id),
  arquivos     INTEGER,
  bytes        BIGINT,
  iniciada_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em TIMESTAMPTZ
);
CREATE INDEX exportacoes_empresa ON exportacoes (empresa_id, concluida_em DESC);

-- Aviso aos Admins (vencimento da pasta geral e guarda vencida): uma vez por documento.
ALTER TABLE documentos ADD COLUMN guarda_avisado_em TIMESTAMPTZ;
-- Saída do cliente: os documentos foram excluídos com aprovação de um Admin.
ALTER TABLE empresas ADD COLUMN saida_em TIMESTAMPTZ;

CREATE INDEX acessos_em ON acessos_documento (em DESC);
