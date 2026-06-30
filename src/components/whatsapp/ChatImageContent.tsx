import { CheckCheck } from 'lucide-react'

interface ChatImageContentProps {
  src: string
  alt: string
  caption?: string | null
  timeLabel: string
  sent: boolean
  loading?: boolean
  onOpen: () => void
}

export function ChatImageContent({
  src,
  alt,
  caption,
  timeLabel,
  sent,
  loading = false,
  onOpen,
}: ChatImageContentProps) {
  if (loading) {
    return (
      <div className="flex h-[200px] w-[280px] max-w-full items-center justify-center rounded-[6px] bg-[#e9edef]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#25d366] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="w-[280px] max-w-full">
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full overflow-hidden rounded-[6px]"
      >
        <img
          src={src}
          alt={alt}
          className="block max-h-[360px] w-full cursor-pointer object-cover transition-opacity group-hover:opacity-95"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-1 pt-6">
          <div className="flex items-end justify-end gap-1">
            <span className="text-[11px] leading-none text-white/95">{timeLabel}</span>
            {sent && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />}
          </div>
        </div>
      </button>
      {caption && (
        <p className="mt-1 whitespace-pre-wrap break-words px-0.5 text-[14.2px] leading-[19px] text-[#111b21]">
          {caption}
        </p>
      )}
    </div>
  )
}
