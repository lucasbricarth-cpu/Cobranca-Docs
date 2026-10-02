-- 007 — notificações: textos editáveis em Ajustes › Mensagens.
CREATE TABLE mensagens (
  chave         TEXT PRIMARY KEY,
  texto         TEXT NOT NULL,
  atualizado_por UUID REFERENCES usuarios(id),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Preferência do funcionário: resumo diário por e-mail (ligado por padrão).
ALTER TABLE usuarios ADD COLUMN resumo_diario BOOLEAN NOT NULL DEFAULT true;
