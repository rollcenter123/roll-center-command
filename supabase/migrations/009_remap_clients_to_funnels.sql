-- Reatribui leads importados do Go42 às etapas do funil correto
UPDATE clients c
SET whatsapp_stage_id = mapped.new_stage_id
FROM (
  SELECT
    c2.id AS client_id,
    ns.id AS new_stage_id
  FROM clients c2
  JOIN whatsapp_funnels f ON c2.custom_fields->>'crm_funnel' = f.name
  JOIN whatsapp_stages old_s ON old_s.id = c2.whatsapp_stage_id
  JOIN whatsapp_stages ns ON ns.funnel_id = f.id
    AND ns.name = COALESCE(
      NULLIF(c2.custom_fields->>'go42_stage', ''),
      CASE old_s.name
        WHEN 'Novos' THEN 'Disparado'
        WHEN 'Em conversa' THEN 'Respondeu'
        WHEN 'Cotação' THEN 'Cotou'
        WHEN 'Não quer' THEN 'Não Quer'
        WHEN 'Cotação feita' THEN 'Não Existe/Mudou'
      END
    )
) mapped
WHERE c.id = mapped.client_id;
