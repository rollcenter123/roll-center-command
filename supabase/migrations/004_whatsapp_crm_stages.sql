-- Etapas de atendimento WhatsApp (colunas do CRM / kanban)

CREATE TABLE whatsapp_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#f97316',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients
  ADD COLUMN whatsapp_stage_id UUID REFERENCES whatsapp_stages(id) ON DELETE SET NULL;

CREATE INDEX clients_whatsapp_stage_idx ON clients (whatsapp_stage_id);
CREATE INDEX whatsapp_stages_position_idx ON whatsapp_stages (position);

CREATE TRIGGER whatsapp_stages_updated_at
  BEFORE UPDATE ON whatsapp_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO whatsapp_stages (name, position, color) VALUES
  ('Novos', 0, '#3b82f6'),
  ('Em conversa', 1, '#22c55e'),
  ('Cotação', 2, '#f97316'),
  ('Cotação feita', 3, '#8b5cf6'),
  ('Não quer', 4, '#6b7280');

ALTER TABLE whatsapp_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read whatsapp stages"
  ON whatsapp_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators can manage whatsapp stages"
  ON whatsapp_stages FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
