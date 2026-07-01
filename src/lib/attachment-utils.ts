import { WA_CHAT } from '@/lib/whatsapp-chat-messages'

export type AttachmentKind = 'image' | 'video' | 'pdf' | 'document'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/3gpp', 'video/quicktime'])
const PDF_TYPE = 'application/pdf'

const VIDEO_EXTENSIONS = new Set(['mp4', '3gp', '3gpp', 'mov', 'm4v'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 16 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024

function fileExtension(file: File): string {
  const parts = file.name.split('.')
  if (parts.length < 2) return ''
  return (parts.pop() ?? '').toLowerCase()
}

export function detectAttachmentKind(file: File): AttachmentKind {
  if (IMAGE_TYPES.has(file.type)) return 'image'
  if (VIDEO_TYPES.has(file.type)) return 'video'
  if (file.type === PDF_TYPE) return 'pdf'

  const ext = fileExtension(file)
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'

  return 'document'
}

/** MIME aceito pela API do WhatsApp para envio */
export function resolveAttachmentMime(file: File, kind: AttachmentKind): string {
  if (kind === 'video') {
    if (file.type === 'video/3gpp') return 'video/3gpp'
    if (file.type === 'video/mp4' || file.type === 'video/quicktime') return 'video/mp4'
    const ext = fileExtension(file)
    if (ext === '3gp' || ext === '3gpp') return 'video/3gpp'
    return 'video/mp4'
  }

  if (kind === 'image') {
    if (IMAGE_TYPES.has(file.type)) return file.type
    const ext = fileExtension(file)
    if (ext === 'png') return 'image/png'
    if (ext === 'webp') return 'image/webp'
    return 'image/jpeg'
  }

  if (kind === 'pdf') return PDF_TYPE

  return file.type || 'application/octet-stream'
}

export function attachmentKindLabel(kind: AttachmentKind): string {
  if (kind === 'image') return 'Imagem'
  if (kind === 'video') return 'Vídeo'
  if (kind === 'pdf') return 'PDF'
  return 'Documento'
}

export function validateAttachmentFile(file: File): string | null {
  const kind = detectAttachmentKind(file)
  const mime = resolveAttachmentMime(file, kind)

  if (kind === 'image' && !IMAGE_TYPES.has(mime)) {
    return WA_CHAT.media.fileSendFailed
  }
  if (kind === 'video' && mime !== 'video/mp4' && mime !== 'video/3gpp') {
    return WA_CHAT.media.fileSendFailed
  }
  if (file.size > MAX_IMAGE_BYTES && kind === 'image') {
    return WA_CHAT.media.tooLarge
  }
  if (file.size > MAX_VIDEO_BYTES && kind === 'video') {
    return WA_CHAT.media.tooLarge
  }
  if (file.size > MAX_DOCUMENT_BYTES && (kind === 'pdf' || kind === 'document')) {
    return WA_CHAT.media.tooLarge
  }

  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function fileToBase64(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export const MEDIA_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,video/mp4,video/3gpp'

export const DOCUMENT_FILE_ACCEPT =
  'application/pdf,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain'
