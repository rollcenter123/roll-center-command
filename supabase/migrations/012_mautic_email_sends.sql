-- Registro de envios de email do Mautic por contato (para aba Email em Clientes)

CREATE TABLE IF NOT EXISTS mautic_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mautic_stat_id INTEGER UNIQUE,
  mautic_email_id INTEGER NOT NULL,
  mautic_contact_id INTEGER NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  email_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mautic_email_id, mautic_contact_id)
);

CREATE INDEX IF NOT EXISTS mautic_email_sends_client_idx ON mautic_email_sends (client_id);
CREATE INDEX IF NOT EXISTS mautic_email_sends_contact_idx ON mautic_email_sends (mautic_contact_id);
CREATE INDEX IF NOT EXISTS mautic_email_sends_email_idx ON mautic_email_sends (mautic_email_id);
CREATE INDEX IF NOT EXISTS mautic_email_sends_sent_at_idx ON mautic_email_sends (sent_at DESC);

CREATE TRIGGER mautic_email_sends_updated_at
  BEFORE UPDATE ON mautic_email_sends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE mautic_email_sends ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON mautic_email_sends TO authenticated;

DROP POLICY IF EXISTS "Authenticated can read mautic_email_sends" ON mautic_email_sends;
CREATE POLICY "Authenticated can read mautic_email_sends"
  ON mautic_email_sends
  FOR SELECT
  TO authenticated
  USING (true);
