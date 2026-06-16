import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { campaign_id } = await req.json()
    if (!campaign_id) return errorResponse('campaign_id required')

    const supabase = getSupabaseAdmin()
    const subdomain = Deno.env.get('UAZAPI_SUBDOMAIN')!

    const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaign_id).single()
    if (!campaign) return errorResponse('Campaign not found', 404)

    const instanceId = campaign.metadata?.instance_id
    let instanceToken = Deno.env.get('UAZAPI_INSTANCE_TOKEN')!

    if (instanceId) {
      const { data: instance } = await supabase.from('whatsapp_instances').select('*').eq('id', instanceId).single()
      if (instance?.instance_token_ref) {
        instanceToken = Deno.env.get(instance.instance_token_ref) ?? instanceToken
      }
    }

    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('*, clients(*)')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')

    let sent = 0
    const errors: string[] = []

    for (const recipient of recipients ?? []) {
      const client = recipient.clients
      if (!client?.phone) continue

      const message = applyTemplate(campaign.message_template ?? '', {
        nome: client.name,
        empresa: client.company ?? '',
        email: client.email ?? '',
        telefone: client.phone ?? '',
      })

      try {
        const res = await fetch(`https://${subdomain}.uazapi.com/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            token: instanceToken,
          },
          body: JSON.stringify({
            number: client.phone,
            text: message,
            track_source: 'roll-center',
            track_id: recipient.id,
          }),
        })

        const data = await res.json()

        if (res.ok) {
          await supabase.from('campaign_recipients').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_message_id: data.messageid ?? data.id ?? null,
          }).eq('id', recipient.id)

          await supabase.from('campaign_events').insert({
            campaign_id,
            client_id: client.id,
            recipient_id: recipient.id,
            event_type: 'sent',
            channel: 'whatsapp',
            provider: 'uazapi',
            payload: data,
          })
          sent++
        } else {
          throw new Error(data.message ?? 'Send failed')
        }

        await new Promise((r) => setTimeout(r, 1000))
      } catch (e) {
        errors.push(`${client.name}: ${e instanceof Error ? e.message : 'error'}`)
        await supabase.from('campaign_recipients').update({
          status: 'failed',
          error_message: e instanceof Error ? e.message : 'error',
        }).eq('id', recipient.id)
      }
    }

    const finalStatus = errors.length === (recipients?.length ?? 0) ? 'failed' : 'completed'
    await supabase.from('campaigns').update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
    }).eq('id', campaign_id)

    return jsonResponse({ sent, errors })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
