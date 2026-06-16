import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    if (body.test) {
      const token = Deno.env.get('WHATSAPP_CLOUD_TOKEN')
      const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
      return jsonResponse({ ok: !!(token && phoneId) })
    }

    const { campaign_id } = body
    if (!campaign_id) return errorResponse('campaign_id required')

    const supabase = getSupabaseAdmin()
    const token = Deno.env.get('WHATSAPP_CLOUD_TOKEN')!
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!

    const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaign_id).single()
    if (!campaign) return errorResponse('Campaign not found', 404)

    const templateName = campaign.metadata?.cloud_template_name as string | undefined

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

      try {
        const messageBody = templateName
          ? {
              messaging_product: 'whatsapp',
              to: client.phone,
              type: 'template',
              template: {
                name: templateName,
                language: { code: 'pt_BR' },
                components: [{
                  type: 'body',
                  parameters: [
                    { type: 'text', text: client.name },
                    { type: 'text', text: client.company ?? '' },
                  ],
                }],
              },
            }
          : {
              messaging_product: 'whatsapp',
              to: client.phone,
              type: 'text',
              text: {
                body: applyTemplate(campaign.message_template ?? '', {
                  nome: client.name,
                  empresa: client.company ?? '',
                }),
              },
            }

        const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageBody),
        })

        const data = await res.json()

        if (res.ok) {
          const msgId = data.messages?.[0]?.id
          await supabase.from('campaign_recipients').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_message_id: msgId,
          }).eq('id', recipient.id)

          await supabase.from('campaign_events').insert({
            campaign_id,
            client_id: client.id,
            recipient_id: recipient.id,
            event_type: 'sent',
            channel: 'whatsapp',
            provider: 'cloud_api',
            payload: data,
          })
          sent++
        } else {
          throw new Error(data.error?.message ?? 'Send failed')
        }

        await new Promise((r) => setTimeout(r, 500))
      } catch (e) {
        errors.push(`${client.name}: ${e instanceof Error ? e.message : 'error'}`)
        await supabase.from('campaign_recipients').update({
          status: 'failed',
          error_message: e instanceof Error ? e.message : 'error',
        }).eq('id', recipient.id)
      }
    }

    await supabase.from('campaigns').update({
      status: errors.length === (recipients?.length ?? 0) ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', campaign_id)

    return jsonResponse({ sent, errors })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
