import type { WhatsAppMessage } from '@/types/database'

const MEDIA_PLACEHOLDERS = new Set(['📷 Imagem', '🎤 Áudio', '🎬 Vídeo', '📄 Documento'])

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
  return message.message_type === 'image' || message.message_type === 'audio'
}
