-- Inbox ao vivo: conversas e mensagens WhatsApp Cloud API

CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone TEXT NOT NULL UNIQUE,
  display_name TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  status TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_messages_conversation_sent_idx
  ON whatsapp_messages (conversation_id, sent_at);

CREATE INDEX whatsapp_conversations_last_message_idx
  ON whatsapp_conversations (last_message_at DESC NULLS LAST);

CREATE TRIGGER whatsapp_conversations_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read whatsapp conversations"
  ON whatsapp_conversations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators can update whatsapp conversations"
  ON whatsapp_conversations FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "Authenticated can read whatsapp messages"
  ON whatsapp_messages FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
