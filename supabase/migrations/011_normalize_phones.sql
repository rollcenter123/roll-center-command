-- Padroniza telefones de clientes e conversas WhatsApp para o formato 55 + DDD + número

CREATE OR REPLACE FUNCTION normalize_br_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF phone IS NULL OR btrim(phone) = '' THEN
    RETURN NULL;
  END IF;

  digits := regexp_replace(phone, '[^0-9]', '', 'g');

  IF digits ~ '^55' AND length(digits) >= 12 THEN
    RETURN digits;
  END IF;

  IF length(digits) IN (10, 11) THEN
    RETURN '55' || digits;
  END IF;

  RETURN NULLIF(digits, '');
END;
$$;

-- Atualiza clientes sem conflito de unicidade
UPDATE clients AS c
SET phone = normalize_br_phone(c.phone)
WHERE c.phone IS NOT NULL
  AND c.phone IS DISTINCT FROM normalize_br_phone(c.phone)
  AND NOT EXISTS (
    SELECT 1
    FROM clients AS c2
    WHERE c2.id <> c.id
      AND c2.phone = normalize_br_phone(c.phone)
  );

-- Atualiza conversas WhatsApp sem conflito de unicidade
UPDATE whatsapp_conversations AS wc
SET wa_phone = normalize_br_phone(wc.wa_phone)
WHERE wc.wa_phone IS DISTINCT FROM normalize_br_phone(wc.wa_phone)
  AND NOT EXISTS (
    SELECT 1
    FROM whatsapp_conversations AS wc2
    WHERE wc2.id <> wc.id
      AND wc2.wa_phone = normalize_br_phone(wc.wa_phone)
  );
