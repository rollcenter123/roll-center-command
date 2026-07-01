import { type MouseEvent } from 'react'
import { downloadChatMedia } from '@/lib/whatsapp-media-client'
import { Download, X } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ImageLightboxProps {
  src: string
  alt?: string
  mimeType?: string | null
  messageType?: string
  fileName?: string
  onClose: () => void
}

export function ImageLightbox({
  src,
  alt = 'Imagem',
  mimeType,
  messageType = 'image',
  fileName,
  onClose,
}: ImageLightboxProps) {
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleDownload = async () => {
    try {
      await downloadChatMedia({
        url: src,
        mimeType,
        messageType,
        fileName: fileName ?? alt,
      })
    } catch {
      window.open(src, '_blank', 'noopener,noreferrer')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar imagem"
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleDownload()}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          <Download className="h-4 w-4" />
          Baixar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  )
}
