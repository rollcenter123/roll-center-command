export function extensionForMedia(mimeType: string | null | undefined, messageType?: string): string {
  const mime = (mimeType ?? '').toLowerCase().split(';')[0].trim()

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

  if (!mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream') {
    if (messageType === 'video') return 'mp4'
    if (messageType === 'audio') return 'm4a'
    if (messageType === 'image') return 'jpg'
    if (messageType === 'document') return 'pdf'
  }

  return 'bin'
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^\w.\-() ]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'arquivo'
}

export async function downloadChatMedia(options: {
  url: string
  mimeType?: string | null
  messageType: string
  fileName?: string
}): Promise<void> {
  const response = await fetch(options.url)
  if (!response.ok) throw new Error('download failed')

  const blob = await response.blob()
  const mime = options.mimeType || blob.type || undefined
  const ext = extensionForMedia(mime, options.messageType)
  const baseName = options.fileName
    ? sanitizeFileName(options.fileName.replace(/\.[^.]+$/, ''))
    : `whatsapp-${options.messageType}`
  const downloadName = `${baseName}.${ext}`

  const fileBlob = mime && blob.type !== mime ? new Blob([await blob.arrayBuffer()], { type: mime }) : blob
  const objectUrl = URL.createObjectURL(fileBlob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = downloadName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export function base64ToObjectUrl(base64: string, mimeType: string): string {
  return URL.createObjectURL(base64ToBlob(base64, mimeType))
}

export function resolveMediaDisplayUrl(
  mediaUrl: string | null | undefined,
  mediaBase64?: string | null,
  mimeType?: string | null,
): string | null {
  if (mediaUrl) return mediaUrl
  if (mediaBase64 && mimeType) return base64ToObjectUrl(mediaBase64, mimeType)
  return null
}

interface FetchMediaResponse {
  media_url?: string
  media_base64?: string
  mime_type?: string
  error?: string
}

export function parseFetchMediaResponse(data: FetchMediaResponse | null): {
  mediaUrl: string | null
  mimeType: string | null
} {
  if (!data || data.error) return { mediaUrl: null, mimeType: null }

  if (data.media_url) {
    return { mediaUrl: data.media_url, mimeType: data.mime_type ?? null }
  }

  if (data.media_base64 && data.mime_type) {
    return {
      mediaUrl: base64ToObjectUrl(data.media_base64, data.mime_type),
      mimeType: data.mime_type,
    }
  }

  return { mediaUrl: null, mimeType: null }
}
