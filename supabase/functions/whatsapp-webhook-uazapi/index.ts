import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const STATUS_MAP: Record<string, string> = {
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  sent: 'sent',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    const supabase = getSupabaseAdmin()

    const trackId = payload.track_id ?? payload.data?.track_id
    const status = payload.status ?? payload.data?.status ?? payload.event

    if (!trackId) return jsonResponse({ received: true })

    const eventType = STATUS_MAP[status] ?? status
    const { data: recipient } = await supabase
      .from('campaign_recipients')
      .select('id, campaign_id, client_id')
      .eq('id', trackId)
      .single()

    if (!recipient) return jsonResponse({ received: true })

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
      provider: 'uazapi',
      payload,
    })

    return jsonResponse({ received: true })
  } catch {
    return jsonResponse({ received: true })
  }
})
