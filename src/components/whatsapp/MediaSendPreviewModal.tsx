import { useEffect, useState } from 'react'
import { FileText, Film, ImageIcon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  attachmentKindLabel,
  detectAttachmentKind,
  formatFileSize,
  type AttachmentKind,
} from '@/lib/attachment-utils'

interface MediaSendPreviewModalProps {
  open: boolean
  file: File | null
  sending: boolean
  error?: string | null
  onClose: () => void
  onConfirm: (file: File, caption?: string) => void
}

function PreviewIcon({ kind }: { kind: AttachmentKind }) {
  const className = 'h-16 w-16 text-roll-orange'
  if (kind === 'video') return <Film className={className} />
  if (kind === 'image') return <ImageIcon className={className} />
  return <FileText className={className} />
}

export function MediaSendPreviewModal({
  open,
  file,
  sending,
  error,
  onClose,
  onConfirm,
}: MediaSendPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')

  useEffect(() => {
    if (!file || !open) {
      setPreviewUrl(null)
      setCaption('')
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, open])

  if (!file) return null

  const kind = detectAttachmentKind(file)
  const canCaption = kind === 'image' || kind === 'video'

  const handleConfirm = () => {
    onConfirm(file, caption.trim() || undefined)
  }

  return (
    <Modal
      open={open}
      onClose={sending ? () => {} : onClose}
      title={`Pré-visualização — ${attachmentKindLabel(kind)}`}
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-roll-gray-500">
          Confira o arquivo antes de enviar para o WhatsApp.
        </p>

        <div className="overflow-hidden rounded-lg border border-roll-gray-200 bg-roll-gray-50">
          {kind === 'image' && previewUrl && (
            <img
              src={previewUrl}
              alt={file.name}
              className="mx-auto max-h-[min(60vh,480px)] w-full object-contain"
            />
          )}

          {kind === 'video' && previewUrl && (
            <video
              src={previewUrl}
              controls
              playsInline
              className="mx-auto max-h-[min(60vh,480px)] w-full bg-black"
            />
          )}

          {kind === 'pdf' && previewUrl && (
            <iframe
              src={previewUrl}
              title={file.name}
              className="h-[min(60vh,480px)] w-full bg-white"
            />
          )}

          {kind === 'document' && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <PreviewIcon kind={kind} />
              <div>
                <p className="font-medium text-roll-gray-900">{file.name}</p>
                <p className="mt-1 text-sm text-roll-gray-500">{formatFileSize(file.size)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-roll-gray-500">
          <span className="rounded-full bg-roll-gray-100 px-2.5 py-1 font-medium text-roll-gray-700">
            {file.name}
          </span>
          <span>{formatFileSize(file.size)}</span>
        </div>

        {canCaption && (
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={sending}
            placeholder="Legenda (opcional)"
            className="w-full rounded-lg border border-roll-gray-300 bg-white px-3 py-2.5 text-sm text-roll-gray-900 placeholder:text-roll-gray-400 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20 disabled:opacity-60"
          />
        )}

        <div className="flex justify-end gap-2 border-t border-roll-gray-100 pt-4">
          {error && (
            <p className="mr-auto flex items-center text-sm text-[#667781]">{error}</p>
          )}
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={sending} loading={sending}>
            {sending ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
