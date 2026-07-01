import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyOperator } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getWhatsAppCloudCredentials } from '../_shared/whatsapp-cloud.ts'
import {
  downloadAndStoreInboundMedia,
  downloadInboundMediaFromMeta,
  extractMetaMediaInfo,
  normalizeMimeType,
  storeWhatsAppMedia,
} from '../_shared/whatsapp-media.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await verifyOperator(req)
    if (!user) return errorResponse('Não autorizado', 401)

    const body = await req.json()
    const messageId = body.message_id as string | undefined
    if (!messageId) return errorResponse('message_id é obrigatório')

    const creds = await getWhatsAppCloudCredentials()
    if (!creds) return errorResponse('WhatsApp Cloud API não configurado', 503)

    const supabase = getSupabaseAdmin()
    const { data: message, error } = await supabase
      .from('whatsapp_messages')
      .select('id, conversation_id, direction, message_type, media_url, media_mime_type, raw_payload')
      .eq('id', messageId)
      .single()

    if (error || !message) return errorResponse('Mensagem não encontrada', 404)
    if (message.media_url) {
      return jsonResponse({ ok: true, media_url: message.media_url })
    }

    const rawPayload = message.raw_payload as Record<string, unknown>
    if (!extractMetaMediaInfo(rawPayload)) {
      return errorResponse('Mensagem sem mídia', 400)
    }

    if (message.direction === 'inbound') {
      const stored = await downloadAndStoreInboundMedia(
        supabase,
        creds.accessToken,
        message.conversation_id,
        message.id,
        rawPayload,
      )

      if (!stored) return errorResponse('Falha ao baixar mídia', 502)

      const storedMime = stored.mimeType
        || message.media_mime_type
        || normalizeMimeType('', message.message_type)

      if (stored.mediaUrl) {
        await supabase
          .from('whatsapp_messages')
          .update({
            media_url: stored.mediaUrl,
            media_mime_type: storedMime,
          })
          .eq('id', message.id)

        return jsonResponse({ ok: true, media_url: stored.mediaUrl, mime_type: storedMime })
      }

      return jsonResponse({
        ok: true,
        media_base64: stored.mediaBase64,
        mime_type: storedMime,
      })
    }

    return errorResponse('Mídia indisponível para esta mensagem', 404)
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Erro desconhecido', 500)
  }
})
