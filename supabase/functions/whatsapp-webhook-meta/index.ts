import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { normalizeWaPhone, persistInboundWhatsAppMessage } from '../_shared/whatsapp-inbox.ts'

const STATUS_MAP: Record<string, string> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const body = await req.json()
    const supabase = getSupabaseAdmin()

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {}
        const phoneNumberId = value.metadata?.phone_number_id as string | undefined
        const contactProfiles = new Map<string, string>()

        for (const contact of value.contacts ?? []) {
          const waId = contact.wa_id as string | undefined
          const name = contact.profile?.name as string | undefined
          if (waId && name) contactProfiles.set(normalizeWaPhone(waId), name)
        }

        const statuses = value.statuses ?? []
        for (const status of statuses) {
          const msgId = status.id
          const eventType = STATUS_MAP[status.status] ?? status.status

          const { data: recipient } = await supabase
            .from('campaign_recipients')
            .select('id, campaign_id, client_id')
            .eq('external_message_id', msgId)
            .single()

          if (!recipient) continue

          const updates: Record<string, unknown> = { status: eventType }
          const now = new Date().toISOString()
          if (eventType === 'delivered') updates.delivered_at = now
          if (eventType === 'read') updates.read_at = now

          await supabase.from('campaign_recipients').update(updates).eq('id', recipient.id)

          await supabase.from('campaign_events').insert({
            campaign_id: recipient.campaign_id,
            client_id: recipient.client_id,
            recipient_id: recipient.id,
            event_type: eventType,
            channel: 'whatsapp',
            provider: 'cloud_api',
            payload: status,
          })
        }

        const messages = value.messages ?? []
        for (const msg of messages) {
          const from = normalizeWaPhone(String(msg.from ?? ''))
          const profileName = contactProfiles.get(from)

          await persistInboundWhatsAppMessage(supabase, msg, {
            phoneNumberId,
            profileName,
          })

          if (msg.type !== 'text') {
            continue
          }

          const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', from)
            .maybeSingle()

          if (!client) continue

          const { data: recipient } = await supabase
            .from('campaign_recipients')
            .select('id, campaign_id')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (recipient) {
            await supabase.from('campaign_recipients').update({
              status: 'replied',
              replied_at: new Date().toISOString(),
            }).eq('id', recipient.id)

            await supabase.from('campaign_events').insert({
              campaign_id: recipient.campaign_id,
              client_id: client.id,
              recipient_id: recipient.id,
              event_type: 'replied',
              channel: 'whatsapp',
              provider: 'cloud_api',
              payload: msg,
            })
          }
        }
      }
    }

    return jsonResponse({ received: true })
  } catch {
    return jsonResponse({ received: true })
  }
})
