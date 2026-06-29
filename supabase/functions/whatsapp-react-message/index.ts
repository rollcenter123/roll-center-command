import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyOperator } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getWhatsAppCloudCredentials } from '../_shared/whatsapp-cloud.ts'

const GRAPH_API_VERSION = 'v21.0'

const EMOJI_TO_UNICODE: Record<string, string> = {
  '👍': '\uD83D\uDC4D',
  '❤️': '\u2764\uFE0F',
  '😂': '\uD83D\uDE02',
  '😮': '\uD83D\uDE2E',
  '😢': '\uD83D\uDE22',
  '🙏': '\uD83D\uDE4F',
}

function normalizeEmoji(emoji: string): string {
  return EMOJI_TO_UNICODE[emoji] ?? emoji
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await verifyOperator(req)
    if (!user) return errorResponse('Não autorizado', 401)

    const body = await req.json()
    const conversationId = body.conversation_id as string | undefined
    const messageId = body.message_id as string | undefined
    const emoji = body.emoji as string | undefined

    if (!conversationId) return errorResponse('conversation_id é obrigatório')
    if (!messageId) return errorResponse('message_id é obrigatório')
    if (!emoji) return errorResponse('emoji é obrigatório')

    const creds = await getWhatsAppCloudCredentials()
    if (!creds) return errorResponse('WhatsApp Cloud API não configurado', 503)

    const supabase = getSupabaseAdmin()
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('id, wa_phone')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) return errorResponse('Conversa não encontrada', 404)

    const { data: message, error: msgError } = await supabase
      .from('whatsapp_messages')
      .select('id, wa_message_id, direction')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .single()

    if (msgError || !message) return errorResponse('Mensagem não encontrada', 404)
    if (message.direction !== 'inbound') {
      return errorResponse('Só é possível reagir a mensagens recebidas do cliente', 400)
    }
    if (!message.wa_message_id) {
      return errorResponse('Esta mensagem não possui ID do WhatsApp para reação', 400)
    }

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
          recipient_type: 'individual',
          to: conversation.wa_phone,
          type: 'reaction',
          reaction: {
            message_id: message.wa_message_id,
            emoji: normalizeEmoji(emoji),
          },
        }),
      },
    )

    const data = await res.json()
    if (!res.ok) {
      const metaError = data.error?.message ?? 'Falha ao enviar reação'
      return errorResponse(metaError, 502)
    }

    return jsonResponse({ ok: true, data })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Erro desconhecido', 500)
  }
})
