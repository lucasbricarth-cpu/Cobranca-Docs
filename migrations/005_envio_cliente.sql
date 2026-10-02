-- 005 — envio do cliente: análise antes de confirmar, e links de envio (QR code e WhatsApp).

ALTER TABLE uploads
  ADD COLUMN nome_original TEXT,
  ADD COLUMN item_id UUID REFERENCES itens_pedido(id) ON DELETE SET NULL,
  ADD COLUMN sensivel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN analise JSONB,                 -- tipo real, CNPJs lidos, sugestão (sem IA se sensível)
  ADD COLUMN link_envio UUID,               -- quando veio por um link de envio (QR/WhatsApp)
  ADD COLUMN confirmado_em TIMESTAMPTZ,
  ADD COLUMN documento_id UUID REFERENCES documentos(id);

-- Link de envio: abre SÓ o envio daquele pedido (sem histórico nem pasta), por um tempo.
-- QR code do computador → celular, e o botão "Enviar pelo app" do WhatsApp.
CREATE TABLE links_envio (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,
  login_id    UUID NOT NULL REFERENCES logins_cliente(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  item_id     UUID REFERENCES itens_pedido(id) ON DELETE CASCADE,
  origem      TEXT NOT NULL CHECK (origem IN ('qr', 'whatsapp', 'email')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em   TIMESTAMPTZ NOT NULL
);
