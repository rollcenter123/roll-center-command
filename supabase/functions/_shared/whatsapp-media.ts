import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH_API_VERSION = 'v21.0'
const BUCKET = 'whatsapp-media'

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'audio/ogg' || mimeType === 'audio/opus') return 'ogg'
  if (mimeType === 'audio/webm') return 'webm'
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') return 'mp3'
  if (mimeType === 'audio/mp4' || mimeType === 'audio/aac') return 'm4a'
  return 'bin'
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
): Promise<string> {
  const path = `${conversationId}/${messageId}.${extensionForMime(mimeType)}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: true })

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

  try {
    const mediaUrl = await storeWhatsAppMedia(
      supabase,
      conversationId,
      messageId,
      bytes,
      mimeType,
    )
    return { mediaUrl, mimeType }
  } catch (e) {
    console.error('storage upload failed, returning base64:', e)
    return {
      mediaUrl: '',
      mimeType,
      mediaBase64: bytesToBase64(bytes),
    }
  }
}
