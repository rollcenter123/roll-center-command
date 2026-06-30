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
