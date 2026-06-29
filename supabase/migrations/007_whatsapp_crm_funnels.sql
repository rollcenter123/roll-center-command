-- Funis do CRM WhatsApp (estrutura similar ao Go42)

CREATE TABLE whatsapp_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whatsapp_stages
  ADD COLUMN funnel_id UUID REFERENCES whatsapp_funnels(id) ON DELETE CASCADE;

CREATE INDEX whatsapp_stages_funnel_position_idx ON whatsapp_stages (funnel_id, position);
CREATE INDEX whatsapp_funnels_position_idx ON whatsapp_funnels (position);

CREATE TRIGGER whatsapp_funnels_updated_at
  BEFORE UPDATE ON whatsapp_funnels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Funil padrão para etapas já existentes (antes da migração Go42)
INSERT INTO whatsapp_funnels (name, position) VALUES ('Atendimento Geral', 99);

UPDATE whatsapp_stages
SET funnel_id = (SELECT id FROM whatsapp_funnels WHERE name = 'Atendimento Geral' LIMIT 1)
WHERE funnel_id IS NULL;

-- Funis de disparo (como no Go42)
INSERT INTO whatsapp_funnels (name, position) VALUES
  ('Disparo Base', 0),
  ('Disparos Felipe', 1),
  ('Disparos Luis Gustavo', 2),
  ('Disparo Gerencia', 3);

-- Etapas padrão em cada funil de disparo
INSERT INTO whatsapp_stages (funnel_id, name, position, color)
SELECT f.id, s.name, s.position, s.color
FROM whatsapp_funnels f
CROSS JOIN (
  VALUES
    ('Disparado', 0, '#3b82f6'),
    ('Respondeu', 1, '#f97316'),
    ('Cotou', 2, '#22c55e'),
    ('Não Quer', 3, '#ef4444'),
    ('Não Existe/Mudou', 4, '#8b5cf6')
) AS s(name, position, color)
WHERE f.name IN ('Disparo Base', 'Disparos Felipe', 'Disparos Luis Gustavo', 'Disparo Gerencia');

ALTER TABLE whatsapp_stages ALTER COLUMN funnel_id SET NOT NULL;

ALTER TABLE whatsapp_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read whatsapp funnels"
  ON whatsapp_funnels FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators can manage whatsapp funnels"
  ON whatsapp_funnels FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
