-- Mídia do inbox WhatsApp (imagens e áudios)

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('whatsapp-media', 'whatsapp-media', true, 16777216)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read whatsapp media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Service role upload whatsapp media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Service role update whatsapp media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'whatsapp-media');
