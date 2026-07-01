import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH_API_VERSION = 'v21.0'
const BUCKET = 'whatsapp-media'

export function extensionForMime(mimeType: string, messageType?: string): string {
  const mime = mimeType.toLowerCase().split(';')[0].trim()

  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'm4a',
    'audio/amr': 'amr',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
  }

  if (byMime[mime]) return byMime[mime]

  if (
    !mime
    || mime === 'application/octet-stream'
    || mime === 'binary/octet-stream'
  ) {
    if (messageType === 'video') return 'mp4'
    if (messageType === 'audio') return 'm4a'
    if (messageType === 'image') return 'jpg'
    if (messageType === 'document') return 'pdf'
  }

  return 'bin'
}

export function normalizeMimeType(mimeType: string, messageType?: string): string {
  const mime = mimeType.toLowerCase().split(';')[0].trim()
  if (mime && mime !== 'application/octet-stream' && mime !== 'binary/octet-stream') {
    return mime
  }
  if (messageType === 'video') return 'video/mp4'
  if (messageType === 'audio') return 'audio/mp4'
  if (messageType === 'image') return 'image/jpeg'
  if (messageType === 'document') return 'application/pdf'
  return mimeType || 'application/octet-stream'
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

export function extractMetaMediaInfo(
  msg: Record<string, unknown>,
): { id: string; mimeType?: string } | null {
  const type = msg.type as string
  const mediaKey = type === 'image' || type === 'audio' || type === 'video' || type === 'document'
    ? type
    : null
  if (!mediaKey) return null

  const media = msg[mediaKey] as { id?: string; mime_type?: string } | undefined
  if (!media?.id) return null
  return { id: media.id, mimeType: media.mime_type }
}

export async function fetchMetaMediaDownloadUrl(
  mediaId: string,
  accessToken: string,
): Promise<{ url: string; mimeType: string }> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Falha ao obter URL da mídia')
  }

  const url = data.url as string | undefined
  const mimeType = (data.mime_type as string | undefined) ?? 'application/octet-stream'
  if (!url) throw new Error('URL de mídia inválida')
  return { url, mimeType }
}

export async function downloadMetaMediaBinary(
  mediaUrl: string,
  accessToken: string,
): Promise<Uint8Array> {
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Falha ao baixar mídia do WhatsApp')
  const buffer = await res.arrayBuffer()
  return new Uint8Array(buffer)
}

export async function downloadInboundMediaFromMeta(
  accessToken: string,
  msg: Record<string, unknown>,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const info = extractMetaMediaInfo(msg)
  if (!info) return null

  const { url, mimeType } = await fetchMetaMediaDownloadUrl(info.id, accessToken)
  const bytes = await downloadMetaMediaBinary(url, accessToken)
  return { bytes, mimeType: info.mimeType ?? mimeType }
}

export async function storeWhatsAppMedia(
  supabase: SupabaseClient,
  conversationId: string,
  messageId: string,
  bytes: Uint8Array,
  mimeType: string,
  messageType?: string,
): Promise<string> {
  const normalizedMime = normalizeMimeType(mimeType, messageType)
  const path = `${conversationId}/${messageId}.${extensionForMime(normalizedMime, messageType)}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: normalizedMime, upsert: true })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function downloadAndStoreInboundMedia(
  supabase: SupabaseClient,
  accessToken: string,
  conversationId: string,
  messageId: string,
  msg: Record<string, unknown>,
): Promise<{ mediaUrl: string; mimeType: string; mediaBase64?: string } | null> {
  const downloaded = await downloadInboundMediaFromMeta(accessToken, msg)
  if (!downloaded) return null

  const { bytes, mimeType } = downloaded
  const messageType = (msg.type as string | undefined) ?? undefined
  const normalizedMime = normalizeMimeType(mimeType, messageType)

  try {
    const mediaUrl = await storeWhatsAppMedia(
      supabase,
      conversationId,
      messageId,
      bytes,
      normalizedMime,
      messageType,
    )
    return { mediaUrl, mimeType: normalizedMime }
  } catch (e) {
    console.error('storage upload failed, returning base64:', e)
    return {
      mediaUrl: '',
      mimeType: normalizedMime,
      mediaBase64: bytesToBase64(bytes),
    }
  }
}
