import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const EVENT_MAP: Record<string, string> = {
  'email.on_open': 'opened',
  'email.on_send': 'sent',
  'email.on_bounce': 'bounced',
  'email.on_unsubscribe': 'unsubscribed',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    const mauticEvents = payload['mautic.email_on_open'] ?? payload['mautic.email_on_send'] ?? payload['mautic.email_on_bounce'] ?? payload['mautic.email_on_unsubscribe']

    if (!mauticEvents) return jsonResponse({ received: true })

    const events = Array.isArray(mauticEvents) ? mauticEvents : [mauticEvents]
    const supabase = getSupabaseAdmin()

    for (const event of events) {
      const contactId = event.contact?.id
      const eventType = EVENT_MAP[Object.keys(payload).find((k) => k.startsWith('mautic.')) ?? ''] ?? 'opened'

      if (!contactId) continue

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('mautic_contact_id', contactId)
        .single()

      if (!client) continue

      const { data: recipient } = await supabase
        .from('campaign_recipients')
        .select('id, campaign_id')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const updateField = eventType === 'opened' ? 'opened_at'
        : eventType === 'sent' ? 'sent_at'
        : eventType === 'bounced' ? 'error_message'
        : null

      if (recipient) {
        const updates: Record<string, unknown> = { status: eventType }
        if (updateField) updates[updateField] = new Date().toISOString()
        await supabase.from('campaign_recipients').update(updates).eq('id', recipient.id)
      }

      await supabase.from('campaign_events').insert({
        campaign_id: recipient?.campaign_id,
        client_id: client.id,
        recipient_id: recipient?.id,
        event_type: eventType,
        channel: 'email',
        provider: 'mautic',
        payload: event,
      })
    }

    return jsonResponse({ received: true })
  } catch {
    return jsonResponse({ received: true })
  }
})
