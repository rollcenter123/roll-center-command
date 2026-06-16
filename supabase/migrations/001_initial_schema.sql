  -- Roll Center Command Center - Schema inicial
  -- Execute no SQL Editor do Supabase

  -- Enums
  CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer');
  CREATE TYPE client_status AS ENUM ('lead', 'contacted', 'converted', 'inactive');
  CREATE TYPE campaign_channel AS ENUM ('email', 'whatsapp');
  CREATE TYPE whatsapp_provider AS ENUM ('uazapi', 'cloud_api');
  CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed');
  CREATE TYPE recipient_status AS ENUM (
    'pending', 'sent', 'delivered', 'opened', 'clicked',
    'read', 'replied', 'failed', 'bounced', 'unsubscribed'
  );
  CREATE TYPE event_type AS ENUM (
    'sent', 'delivered', 'opened', 'clicked',
    'read', 'replied', 'failed', 'bounced', 'unsubscribed'
  );
  CREATE TYPE integration_provider AS ENUM ('mautic', 'uazapi', 'whatsapp_cloud');

  -- Profiles
  CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Clients
  CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status client_status NOT NULL DEFAULT 'lead',
    source TEXT,
    notes TEXT,
    mautic_contact_id INTEGER,
    whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true,
    email_opt_in BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX clients_email_unique ON clients (email) WHERE email IS NOT NULL;
  CREATE UNIQUE INDEX clients_phone_unique ON clients (phone) WHERE phone IS NOT NULL;
  CREATE INDEX clients_status_idx ON clients (status);
  CREATE INDEX clients_created_at_idx ON clients (created_at);

  -- Campaigns
  CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    channel campaign_channel NOT NULL,
    whatsapp_provider whatsapp_provider,
    status campaign_status NOT NULL DEFAULT 'draft',
    mautic_campaign_id INTEGER,
    message_template TEXT,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX campaigns_channel_idx ON campaigns (channel);
  CREATE INDEX campaigns_status_idx ON campaigns (status);

  -- Campaign Recipients
  CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status recipient_status NOT NULL DEFAULT 'pending',
    external_message_id TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, client_id)
  );

  CREATE INDEX campaign_recipients_campaign_idx ON campaign_recipients (campaign_id);
  CREATE INDEX campaign_recipients_status_idx ON campaign_recipients (status);

  -- Campaign Events
  CREATE TABLE campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES campaign_recipients(id) ON DELETE SET NULL,
    event_type event_type NOT NULL,
    channel campaign_channel,
    provider TEXT,
    payload JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX campaign_events_campaign_idx ON campaign_events (campaign_id);
  CREATE INDEX campaign_events_type_idx ON campaign_events (event_type);
  CREATE INDEX campaign_events_occurred_idx ON campaign_events (occurred_at);

  -- Integration Settings
  CREATE TABLE integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider integration_provider NOT NULL UNIQUE,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- WhatsApp Instances (UAZAPI)
  CREATE TABLE whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    instance_token_ref TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    phone_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Daily Metrics
  CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    channel TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    delivered INTEGER NOT NULL DEFAULT 0,
    opened INTEGER NOT NULL DEFAULT 0,
    clicked INTEGER NOT NULL DEFAULT 0,
    read_count INTEGER NOT NULL DEFAULT 0,
    replied INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    new_clients INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (date, channel)
  );

  -- Updated_at trigger
  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER campaign_recipients_updated_at BEFORE UPDATE ON campaign_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER integration_settings_updated_at BEFORE UPDATE ON integration_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  CREATE TRIGGER whatsapp_instances_updated_at BEFORE UPDATE ON whatsapp_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  -- Auto-create profile on signup
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'viewer'
    );
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

  -- Helper: get user role
  CREATE OR REPLACE FUNCTION get_user_role()
  RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
  $$ LANGUAGE sql SECURITY DEFINER STABLE;

  -- RLS
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
  ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
  ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

  -- Profiles policies
  CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
  CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE TO authenticated USING (get_user_role() = 'admin');

  -- Clients policies
  CREATE POLICY "Authenticated can read clients" ON clients FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Operators can insert clients" ON clients FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('admin', 'operator'));
  CREATE POLICY "Operators can update clients" ON clients FOR UPDATE TO authenticated USING (get_user_role() IN ('admin', 'operator'));
  CREATE POLICY "Admins can delete clients" ON clients FOR DELETE TO authenticated USING (get_user_role() = 'admin');

  -- Campaigns policies
  CREATE POLICY "Authenticated can read campaigns" ON campaigns FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Operators can insert campaigns" ON campaigns FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('admin', 'operator'));
  CREATE POLICY "Operators can update campaigns" ON campaigns FOR UPDATE TO authenticated USING (get_user_role() IN ('admin', 'operator'));
  CREATE POLICY "Admins can delete campaigns" ON campaigns FOR DELETE TO authenticated USING (get_user_role() = 'admin');

  -- Campaign recipients policies
  CREATE POLICY "Authenticated can read recipients" ON campaign_recipients FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Operators can manage recipients" ON campaign_recipients FOR ALL TO authenticated USING (get_user_role() IN ('admin', 'operator'));

  -- Campaign events policies
  CREATE POLICY "Authenticated can read events" ON campaign_events FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Service can insert events" ON campaign_events FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('admin', 'operator'));

  -- Integration settings policies
  CREATE POLICY "Authenticated can read integrations" ON integration_settings FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admins can manage integrations" ON integration_settings FOR ALL TO authenticated USING (get_user_role() = 'admin');

  -- WhatsApp instances policies
  CREATE POLICY "Authenticated can read instances" ON whatsapp_instances FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admins can manage instances" ON whatsapp_instances FOR ALL TO authenticated USING (get_user_role() = 'admin');

  -- Daily metrics policies
  CREATE POLICY "Authenticated can read metrics" ON daily_metrics FOR SELECT TO authenticated USING (true);

  -- Promover primeiro admin (execute após criar sua conta):
  -- UPDATE profiles SET role = 'admin' WHERE id = 'SEU_USER_ID';
