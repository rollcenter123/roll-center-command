import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyOperator } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getWhatsAppCloudCredentials } from '../_shared/whatsapp-cloud.ts'
import { persistOutboundWhatsAppMessage } from '../_shared/whatsapp-inbox.ts'

const GRAPH_API_VERSION = 'v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await verifyOperator(req)
    if (!user) return errorResponse('Não autorizado', 401)

    const body = await req.json()
    const conversationId = body.conversation_id as string | undefined
    const text = (body.text as string | undefined)?.trim()

    if (!conversationId) return errorResponse('conversation_id é obrigatório')
    if (!text) return errorResponse('Mensagem vazia')

    const creds = await getWhatsAppCloudCredentials()
    if (!creds) return errorResponse('WhatsApp Cloud API não configurado', 503)

    const supabase = getSupabaseAdmin()
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('id, wa_phone')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) return errorResponse('Conversa não encontrada', 404)

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${creds.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: conversation.wa_phone,
          type: 'text',
          text: { body: text },
        }),
      },
    )

    const data = await res.json()
    if (!res.ok) {
      const metaError = data.error?.message ?? 'Falha ao enviar mensagem'
      return errorResponse(metaError, 502)
    }

    const waMessageId = data.messages?.[0]?.id as string | undefined
    const message = await persistOutboundWhatsAppMessage(
      supabase,
      conversationId,
      text,
      {
        waMessageId,
        rawPayload: data,
        phoneNumberId: creds.phoneNumberId,
      },
    )

    return jsonResponse({ ok: true, message })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Erro desconhecido', 500)
  }
})
