-- 006 — classificação: correções do funcionário (para medir o acerto por tipo).
CREATE TABLE correcoes_classificacao (
  id               BIGSERIAL PRIMARY KEY,
  documento_id     UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  origem           TEXT NOT NULL CHECK (origem IN ('xml', 'ofx', 'ia')),
  tipo_sugerido    UUID REFERENCES tipos_documento(id),
  subtipo_sugerido UUID REFERENCES subtipos(id) ON DELETE SET NULL,
  tipo_final       UUID REFERENCES tipos_documento(id),
  subtipo_final    UUID REFERENCES subtipos(id) ON DELETE SET NULL,
  acertou_tipo     BOOLEAN NOT NULL,
  acertou_subtipo  BOOLEAN,
  usuario_id       UUID REFERENCES usuarios(id),
  em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (documento_id)
);
CREATE INDEX correcoes_tipo ON correcoes_classificacao (tipo_final, em);
