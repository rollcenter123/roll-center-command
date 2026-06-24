-- Restringe leitura de integration_settings a admins (config pode conter access_token)
DROP POLICY IF EXISTS "Authenticated can read integrations" ON integration_settings;

CREATE POLICY "Admins can read integrations" ON integration_settings
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');
