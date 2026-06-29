-- Vínculo entre perfil interno e membro exportado do Go42 (importação de leads)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS go42_member_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_go42_member_id_idx
  ON profiles (go42_member_id)
  WHERE go42_member_id IS NOT NULL;
