import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function normalizeWaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

export function messageBodyFromMeta(msg: Record<string, unknown>): string {
  const type = msg.type as string
  if (type === 'text') return (msg.text as { body?: string })?.body ?? ''
  if (type === 'image') return '📷 Imagem'
  if (type === 'audio') return '🎤 Áudio'
  if (type === 'video') return '🎬 Vídeo'
  if (type === 'document') return '📄 Documento'
  if (type === 'sticker') return 'Figurinha'
  if (type === 'location') return '📍 Localização'
  if (type === 'contacts') return '👤 Contato'
  if (type === 'button') return (msg.button as { text?: string })?.text ?? 'Botão'
  if (type === 'interactive') {
    const interactive = msg.interactive as Record<string, unknown> | undefined
    const buttonReply = interactive?.button_reply as { title?: string } | undefined
    const listReply = interactive?.list_reply as { title?: string } | undefined
    return buttonReply?.title ?? listReply?.title ?? 'Resposta interativa'
  }
  return `[${type ?? 'mensagem'}]`
}

async function findClientByWaPhone(
  supabase: SupabaseClient,
  waPhone: string,
) {
  const { data: exact } = await supabase
    .from('clients')
    .select('id, name, phone, email, company, notes, whatsapp_stage_id')
    .eq('phone', waPhone)
    .maybeSingle()

  if (exact) return exact

  if (waPhone.startsWith('55') && waPhone.length === 13) {
    const withoutNine = `${waPhone.slice(0, 4)}${waPhone.slice(5)}`
    const { data: alt } = await supabase
      .from('clients')
      .select('id, name, phone, email, company, notes, whatsapp_stage_id')
      .eq('phone', withoutNine)
      .maybeSingle()
    if (alt) return alt
  }

  return null
}

export async function persistInboundWhatsAppMessage(
  supabase: SupabaseClient,
  msg: Record<string, unknown>,
  options: {
    phoneNumberId?: string
    profileName?: string
  } = {},
): Promise<void> {
  const from = normalizeWaPhone(String(msg.from ?? ''))
  if (!from) return

  const body = messageBodyFromMeta(msg)
  const sentAt = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString()
  const waMessageId = msg.id as string | undefined

  if (waMessageId) {
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('wa_message_id', waMessageId)
      .maybeSingle()
    if (existing) return
  }

  const client = await findClientByWaPhone(supabase, from)
  const displayName = client?.name ?? options.profileName ?? from

  const { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('id, unread_count, display_name, client_id')
    .eq('wa_phone', from)
    .maybeSingle()

  let conversationId = conversation?.id

  if (conversation) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        display_name: conversation.display_name || displayName,
        client_id: conversation.client_id ?? client?.id ?? null,
        phone_number_id: options.phoneNumberId ?? undefined,
        last_message_preview: body.slice(0, 200),
        last_message_at: sentAt,
        unread_count: (conversation.unread_count ?? 0) + 1,
      })
      .eq('id', conversation.id)
  } else {
    const { data: created, error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        wa_phone: from,
        display_name: displayName,
        client_id: client?.id ?? null,
        phone_number_id: options.phoneNumberId ?? null,
        last_message_preview: body.slice(0, 200),
        last_message_at: sentAt,
        unread_count: 1,
      })
      .select('id')
      .single()

    if (error || !created) return
    conversationId = created.id
  }

  if (!conversationId) return

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    wa_message_id: waMessageId ?? null,
    direction: 'inbound',
    message_type: (msg.type as string) ?? 'text',
    body,
    raw_payload: msg,
    sent_at: sentAt,
  })
}

export async function persistOutboundWhatsAppMessage(
  supabase: SupabaseClient,
  conversationId: string,
  body: string,
  options: {
    waMessageId?: string
    rawPayload?: Record<string, unknown>
    phoneNumberId?: string
  } = {},
) {
  const sentAt = new Date().toISOString()
  const preview = body.slice(0, 200)

  const { data: message, error } = await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      wa_message_id: options.waMessageId ?? null,
      direction: 'outbound',
      message_type: 'text',
      body,
      raw_payload: options.rawPayload ?? {},
      status: 'sent',
      sent_at: sentAt,
    })
    .select('*')
    .single()

  if (error) throw error

  await supabase
    .from('whatsapp_conversations')
    .update({
      last_message_preview: preview,
      last_message_at: sentAt,
      phone_number_id: options.phoneNumberId ?? undefined,
    })
    .eq('id', conversationId)

  return message
}
