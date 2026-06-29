import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyOperator } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getWhatsAppCloudCredentials } from '../_shared/whatsapp-cloud.ts'
import { persistOutboundWhatsAppMessage } from '../_shared/whatsapp-inbox.ts'

const GRAPH_API_VERSION = 'v21.0'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

async function uploadWhatsAppMedia(
  phoneNumberId: string,
  accessToken: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mimeType)
  form.append('file', new Blob([bytes], { type: mimeType }), `photo.${extensionForMime(mimeType)}`)

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Falha ao enviar mídia para o WhatsApp')
  }

  const mediaId = data.id as string | undefined
  if (!mediaId) throw new Error('Resposta de mídia inválida')
  return mediaId
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await verifyOperator(req)
    if (!user) return errorResponse('Não autorizado', 401)

    const body = await req.json()
    const conversationId = body.conversation_id as string | undefined
    const text = (body.text as string | undefined)?.trim()
    const imageBase64 = body.image_base64 as string | undefined
    const mimeType = (body.mime_type as string | undefined) ?? 'image/jpeg'
    const caption = (body.caption as string | undefined)?.trim()

    if (!conversationId) return errorResponse('conversation_id é obrigatório')

    const creds = await getWhatsAppCloudCredentials()
    if (!creds) return errorResponse('WhatsApp Cloud API não configurado', 503)

    const supabase = getSupabaseAdmin()
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('id, wa_phone')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) return errorResponse('Conversa não encontrada', 404)

    if (imageBase64) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(mimeType)) {
        return errorResponse('Formato de imagem não suportado. Use JPG, PNG ou WebP.', 400)
      }

      const bytes = base64ToBytes(imageBase64)
      if (bytes.length > MAX_IMAGE_BYTES) {
        return errorResponse('Imagem muito grande. Máximo 5 MB.', 400)
      }

      const mediaId = await uploadWhatsAppMedia(
        creds.phoneNumberId,
        creds.accessToken,
        bytes,
        mimeType,
      )

      const payload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        to: conversation.wa_phone,
        type: 'image',
        image: { id: mediaId },
      }
      if (caption) {
        payload.image = { id: mediaId, caption }
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${creds.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      const data = await res.json()
      if (!res.ok) {
        const metaError = data.error?.message ?? 'Falha ao enviar imagem'
        return errorResponse(metaError, 502)
      }

      const waMessageId = data.messages?.[0]?.id as string | undefined
      const previewBody = caption || '📷 Imagem'
      const message = await persistOutboundWhatsAppMessage(
        supabase,
        conversationId,
        previewBody,
        {
          waMessageId,
          rawPayload: data,
          phoneNumberId: creds.phoneNumberId,
          messageType: 'image',
        },
      )

      return jsonResponse({ ok: true, message })
    }

    if (!text) return errorResponse('Mensagem vazia')

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
