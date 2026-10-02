-- 010 — piloto (Etapa 10): poucas empresas, de responsáveis diferentes, por um mês.
-- Com pelo menos uma empresa marcada, o app fica em "modo piloto": a agenda e os
-- avisos automáticos ao cliente (push, e-mail e WhatsApp) só valem para elas.
-- Desmarcar todas = carteira inteira.
ALTER TABLE empresas ADD COLUMN piloto BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX empresas_piloto ON empresas (id) WHERE piloto;
