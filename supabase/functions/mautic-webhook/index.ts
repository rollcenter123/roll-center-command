import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { mauticFetch } from '../_shared/mautic.ts'
import { upsertMauticEmailSend } from '../_shared/mautic-email-sync.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const EVENT_MAP: Record<string, string> = {
  'email.on_open': 'opened',
  'email.on_send': 'sent',
  'email.on_bounce': 'bounced',
  'email.on_unsubscribe': 'unsubscribed',
}

function eventKey(payload: Record<string, unknown>): string | null {
  return Object.keys(payload).find((key) => key.startsWith('mautic.')) ?? null
}

function contactEmail(event: Record<string, unknown>): string | null {
  const contact = event.contact as Record<string, unknown> | undefined
  const fields = contact?.fields as Record<string, Record<string, unknown>> | undefined
  const coreEmail = fields?.core?.email
  const allEmail = fields?.all?.email

  if (coreEmail && typeof coreEmail === 'object' && 'value' in coreEmail) {
    return String((coreEmail as { value?: unknown }).value ?? '').trim() || null
  }
  if (allEmail && typeof allEmail === 'object' && 'value' in allEmail) {
    return String((allEmail as { value?: unknown }).value ?? '').trim() || null
  }

  const stat = event.stat as Record<string, unknown> | undefined
  if (stat?.email_address) return String(stat.email_address).trim()

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json() as Record<string, unknown>
    const key = eventKey(payload)
    const mauticEvents = key ? payload[key] : null

    if (!mauticEvents) return jsonResponse({ received: true })

    const events = Array.isArray(mauticEvents) ? mauticEvents : [mauticEvents]
    const supabase = getSupabaseAdmin()
    const eventType = EVENT_MAP[key ?? ''] ?? 'opened'

    for (const event of events as Record<string, unknown>[]) {
      const contact = event.contact as Record<string, unknown> | undefined
      const stat = event.stat as Record<string, unknown> | undefined
      const email = event.email as Record<string, unknown> | undefined
      const contactId = Number(contact?.id ?? stat?.lead_id)
      const emailId = Number(email?.id ?? stat?.email_id)
      const emailAddress = contactEmail(event)

      if (!contactId) continue

      const clientId = await upsertMauticEmailSend(supabase, mauticFetch, {
        mauticContactId: contactId,
        mauticEmailId: emailId || null,
        emailAddress,
        sentAt: typeof stat?.date_sent === 'string' ? stat.date_sent : new Date().toISOString(),
        status: eventType,
        openedAt: typeof stat?.date_read === 'string' ? stat.date_read : null,
        isRead: eventType === 'opened',
        mauticStatId: stat?.id ? Number(stat.id) : null,
      })

      if (!clientId) continue

      const { data: recipient } = await supabase
        .from('campaign_recipients')
        .select('id, campaign_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
        campaign_id: recipient?.campaign_id ?? null,
        client_id: clientId,
        recipient_id: recipient?.id ?? null,
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
