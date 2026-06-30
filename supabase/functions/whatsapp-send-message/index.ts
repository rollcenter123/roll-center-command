import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyOperator } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getWhatsAppCloudCredentials } from '../_shared/whatsapp-cloud.ts'
import { persistOutboundWhatsAppMessage } from '../_shared/whatsapp-inbox.ts'
import { extensionForMime, storeWhatsAppMedia } from '../_shared/whatsapp-media.ts'

const GRAPH_API_VERSION = 'v21.0'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_AUDIO_BYTES = 16 * 1024 * 1024

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function uploadMimeForAudio(recordedMime: string): string {
  if (recordedMime.includes('ogg')) return 'audio/ogg'
  if (recordedMime.includes('webm')) return 'audio/ogg'
  if (recordedMime.includes('mpeg') || recordedMime.includes('mp3')) return 'audio/mpeg'
  if (recordedMime.includes('mp4') || recordedMime.includes('aac')) return 'audio/mp4'
  return 'audio/ogg'
}

function uploadFileName(mimeType: string, kind: 'image' | 'audio'): string {
  if (kind === 'image') return `photo.${extensionForMime(mimeType)}`
  return `voice.${extensionForMime(uploadMimeForAudio(mimeType))}`
}

async function uploadWhatsAppMedia(
  phoneNumberId: string,
  accessToken: string,
  bytes: Uint8Array,
  mimeType: string,
  kind: 'image' | 'audio',
): Promise<string> {
  const uploadMime = kind === 'audio' ? uploadMimeForAudio(mimeType) : mimeType
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', uploadMime)
  form.append('file', new Blob([bytes], { type: uploadMime }), uploadFileName(mimeType, kind))

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

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        ...payload,
      }),
    },
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Falha ao enviar mensagem')
  }
  return data
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
    const audioBase64 = body.audio_base64 as string | undefined
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

      const storageId = crypto.randomUUID()
      const mediaUrl = await storeWhatsAppMedia(
        supabase,
        conversationId,
        storageId,
        bytes,
        mimeType,
      )

      const mediaId = await uploadWhatsAppMedia(
        creds.phoneNumberId,
        creds.accessToken,
        bytes,
        mimeType,
        'image',
      )

      const imagePayload: Record<string, unknown> = { id: mediaId }
      if (caption) imagePayload.caption = caption

      const data = await sendWhatsAppMessage(
        creds.phoneNumberId,
        creds.accessToken,
        conversation.wa_phone,
        { type: 'image', image: imagePayload },
      )

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
          mediaUrl,
          mediaMimeType: mimeType,
        },
      )

      return jsonResponse({ ok: true, message })
    }

    if (audioBase64) {
      const bytes = base64ToBytes(audioBase64)
      if (bytes.length > MAX_AUDIO_BYTES) {
        return errorResponse('Áudio muito grande. Máximo 16 MB.', 400)
      }

      const storageId = crypto.randomUUID()
      const storedMime = uploadMimeForAudio(mimeType)
      const mediaUrl = await storeWhatsAppMedia(
        supabase,
        conversationId,
        storageId,
        bytes,
        storedMime,
      )

      const mediaId = await uploadWhatsAppMedia(
        creds.phoneNumberId,
        creds.accessToken,
        bytes,
        mimeType,
        'audio',
      )

      const data = await sendWhatsAppMessage(
        creds.phoneNumberId,
        creds.accessToken,
        conversation.wa_phone,
        { type: 'audio', audio: { id: mediaId } },
      )

      const waMessageId = data.messages?.[0]?.id as string | undefined
      const message = await persistOutboundWhatsAppMessage(
        supabase,
        conversationId,
        '🎤 Áudio',
        {
          waMessageId,
          rawPayload: data,
          phoneNumberId: creds.phoneNumberId,
          messageType: 'audio',
          mediaUrl,
          mediaMimeType: storedMime,
        },
      )

      return jsonResponse({ ok: true, message })
    }

    if (!text) return errorResponse('Mensagem vazia')

    const data = await sendWhatsAppMessage(
      creds.phoneNumberId,
      creds.accessToken,
      conversation.wa_phone,
      { type: 'text', text: { body: text } },
    )

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
