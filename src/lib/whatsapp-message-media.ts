import type { WhatsAppMessage } from '@/types/database'
import { WA_CHAT } from '@/lib/whatsapp-chat-messages'

const MEDIA_PLACEHOLDERS = new Set(['📷 Imagem', '🎤 Áudio', '🎬 Vídeo', '📄 Documento'])

const TECHNICAL_UNSUPPORTED_BODIES = new Set([
  '[unsupported]',
  '[unsupported message]',
  'unsupported',
  'unsupported message',
])

function normalizeBodyText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function isUnsupportedMessage(message: {
  body?: string | null
  message_type?: string | null
}): boolean {
  const body = normalizeBodyText(message.body)
  const type = normalizeBodyText(message.message_type)
  return type === 'unsupported' || type === 'unknown' || TECHNICAL_UNSUPPORTED_BODIES.has(body)
}

export function isTechnicalBracketBody(body: string | null | undefined): boolean {
  if (!body) return false
  return /^\[[^\]]+\]$/.test(body.trim())
}

export function displayMessageBody(message: WhatsAppMessage): string {
  if (isUnsupportedMessage(message)) {
    return WA_CHAT.message.unsupported
  }

  const body = message.body?.trim()
  if (body && !isTechnicalBracketBody(body)) return body
  if (body && isTechnicalBracketBody(body)) {
    return WA_CHAT.message.unknownType
  }

  return displayMessageTypeLabel(message.message_type)
}

export function displayMessageTypeLabel(messageType: string): string {
  const type = messageType?.toLowerCase()
  if (type === 'unsupported' || type === 'unknown') return WA_CHAT.message.unsupported
  if (type === 'text') return ''
  if (type === 'image') return '📷 Imagem'
  if (type === 'audio') return '🎤 Áudio'
  if (type === 'video') return '🎬 Vídeo'
  if (type === 'document') return '📄 Documento'
  if (type === 'sticker') return 'Figurinha'
  if (type === 'location') return '📍 Localização'
  if (type === 'contacts') return '👤 Contato'
  return WA_CHAT.message.unknownType
}

export function displayMessagePreview(
  preview: string | null | undefined,
  messageType?: string | null,
): string {
  if (!preview?.trim()) return 'Sem mensagens'

  const normalized = normalizeBodyText(preview)
  if (TECHNICAL_UNSUPPORTED_BODIES.has(normalized)) {
    return WA_CHAT.message.unsupported
  }
  const type = normalizeBodyText(messageType)
  if (type === 'unsupported' || type === 'unknown') {
    return WA_CHAT.message.unsupported
  }
  if (isTechnicalBracketBody(preview)) {
    return WA_CHAT.message.unknownType
  }

  return preview
}

export function isMediaPlaceholder(body: string | null | undefined): boolean {
  if (!body) return false
  return MEDIA_PLACEHOLDERS.has(body)
}

export function imageCaption(message: WhatsAppMessage): string | null {
  const body = message.body
  if (body && !isMediaPlaceholder(body)) return body

  const raw = message.raw_payload
  const image = raw?.image as { caption?: string } | undefined
  return image?.caption ?? null
}

export function needsMediaFetch(message: WhatsAppMessage): boolean {
  if (message.media_url) return false
  return message.message_type === 'image'
    || message.message_type === 'audio'
    || message.message_type === 'video'
    || message.message_type === 'document'
}
