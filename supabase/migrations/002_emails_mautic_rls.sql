-- Tabela sincronizada do Mautic (criada no Supabase; esta migration garante permissões de leitura)
-- Execute no SQL Editor se a tabela já existir sem policies.

CREATE TABLE IF NOT EXISTS emails_mautic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mautic_email_id INTEGER NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  assunto TEXT,
  segmento TEXT,
  enviados INTEGER NOT NULL DEFAULT 0,
  abertos INTEGER NOT NULL DEFAULT 0,
  publicado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS emails_mautic_mautic_email_id_idx ON emails_mautic (mautic_email_id);
CREATE INDEX IF NOT EXISTS emails_mautic_synced_at_idx ON emails_mautic (synced_at DESC);

ALTER TABLE emails_mautic ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON emails_mautic TO authenticated;

DROP POLICY IF EXISTS "Authenticated can read emails_mautic" ON emails_mautic;
CREATE POLICY "Authenticated can read emails_mautic"
  ON emails_mautic
  FOR SELECT
  TO authenticated
  USING (true);
