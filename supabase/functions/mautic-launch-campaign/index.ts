import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { mauticFetch } from '../_shared/mautic.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { campaign_id } = await req.json()
    if (!campaign_id) return errorResponse('campaign_id required')

    const supabase = getSupabaseAdmin()

    const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaign_id).single()
    if (!campaign?.mautic_campaign_id) return errorResponse('Campaign has no Mautic ID')

    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('*, clients(*)')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')

    let sent = 0
    const errors: string[] = []

    for (const recipient of recipients ?? []) {
      const client = recipient.clients
      if (!client) continue

      try {
        let mauticContactId = client.mautic_contact_id

        if (!mauticContactId && client.email) {
          const createRes = await mauticFetch('/contacts/new', {
            method: 'POST',
            body: JSON.stringify({
              firstname: client.name.split(' ')[0],
              lastname: client.name.split(' ').slice(1).join(' ') || '',
              email: client.email,
            }),
          })
          const createData = await createRes.json()
          mauticContactId = createData.contact?.id
          if (mauticContactId) {
            await supabase.from('clients').update({ mautic_contact_id: mauticContactId }).eq('id', client.id)
          }
        }

        if (mauticContactId) {
          await mauticFetch(`/campaigns/${campaign.mautic_campaign_id}/contact/${mauticContactId}/add`, {
            method: 'POST',
          })

          await supabase.from('campaign_recipients').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          }).eq('id', recipient.id)

          await supabase.from('campaign_events').insert({
            campaign_id,
            client_id: client.id,
            recipient_id: recipient.id,
            event_type: 'sent',
            channel: 'email',
            provider: 'mautic',
          })

          sent++
        }
      } catch (e) {
        errors.push(`${client.name}: ${e instanceof Error ? e.message : 'error'}`)
        await supabase.from('campaign_recipients').update({
          status: 'failed',
          error_message: e instanceof Error ? e.message : 'error',
        }).eq('id', recipient.id)
      }
    }

    await supabase.from('campaigns').update({
      status: 'running',
      started_at: new Date().toISOString(),
    }).eq('id', campaign_id)

    return jsonResponse({ sent, errors })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
