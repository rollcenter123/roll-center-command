import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  Copy,
  Flag,
  Forward,
  Pin,
  Plus,
  Reply,
  Smile,
  Star,
  Trash2,
} from 'lucide-react'
import type { WhatsAppMessage } from '@/types/database'
import { imageCaption, isMediaPlaceholder, needsMediaFetch } from '@/lib/whatsapp-message-media'
import { ChatImageContent } from '@/components/whatsapp/ChatImageContent'
import { ImageLightbox } from '@/components/whatsapp/ImageLightbox'
import { WhatsAppAudioPlayer } from '@/components/whatsapp/WhatsAppAudioPlayer'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
const MENU_WIDTH = 220

interface ChatMessageBubbleProps {
  message: WhatsAppMessage
  timeLabel: string
  contactName?: string
  reaction?: string
  onReact: (messageId: string, emoji: string) => void
  onReply: (message: WhatsAppMessage) => void
  onCopy: (text: string) => void
  onNotice: (text: string) => void
  onFetchMedia?: (messageId: string) => Promise<string | null>
}

export function ChatMessageBubble({
  message,
  timeLabel,
  contactName = 'Contato',
  reaction,
  onReact,
  onReply,
  onCopy,
  onNotice,
  onFetchMedia,
}: ChatMessageBubbleProps) {
  const sent = message.direction === 'outbound'
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [mediaUrl, setMediaUrl] = useState<string | null>(message.media_url ?? null)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMediaUrl(message.media_url ?? null)
    setMediaFailed(false)
  }, [message.media_url, message.id])

  const loadMedia = async () => {
    if (!onFetchMedia || mediaUrl) return
    setMediaLoading(true)
    setMediaFailed(false)
    const url = await onFetchMedia(message.id)
    if (url) {
      setMediaUrl(url)
    } else {
      setMediaFailed(true)
    }
    setMediaLoading(false)
  }

  useEffect(() => {
    if (mediaUrl || !needsMediaFetch(message) || !onFetchMedia) return
    void loadMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.message_type, mediaUrl, onFetchMedia])

  const updateMenuPosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const left = sent
      ? Math.max(8, rect.right - MENU_WIDTH)
      : Math.min(window.innerWidth - MENU_WIDTH - 8, rect.left)

    setMenuPos({
      top: rect.bottom + 8,
      left,
    })
  }

  useEffect(() => {
    if (!menuOpen) return

    updateMenuPosition()

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      const target = event.target as HTMLElement
      if (target.closest('[data-message-menu]')) return
      setMenuOpen(false)
    }

    const handleReposition = () => updateMenuPosition()

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [menuOpen, sent])

  const body = message.body ?? `[${message.message_type}]`
  const caption = imageCaption(message)
  const isImage = message.message_type === 'image'
  const isAudio = message.message_type === 'audio'
  const isMedia = isImage || isAudio
  const copyText = caption || (isMediaPlaceholder(body) ? '' : body)

  const menuItems: {
    id: string
    label: string
    icon: typeof Reply
    action: () => void
    danger?: boolean
  }[] = [
    { id: 'reply', label: 'Responder', icon: Reply, action: () => onReply(message) },
    { id: 'copy', label: 'Copiar', icon: Copy, action: () => onCopy(copyText || body) },
    { id: 'react', label: 'Reagir', icon: Smile, action: () => onNotice('Escolha um emoji acima.') },
    { id: 'forward', label: 'Encaminhar', icon: Forward, action: () => onNotice('Encaminhar em breve.') },
    { id: 'pin', label: 'Fixar', icon: Pin, action: () => onNotice('Fixar em breve.') },
    { id: 'star', label: 'Favoritar', icon: Star, action: () => onNotice('Favoritar em breve.') },
    { id: 'report', label: 'Denunciar', icon: Flag, action: () => onNotice('Denunciar em breve.') },
    { id: 'delete', label: 'Apagar', icon: Trash2, action: () => onNotice('Apagar em breve.'), danger: true },
  ]

  const pickReaction = (emoji: string) => {
    onReact(message.id, emoji)
    setMenuOpen(false)
  }

  const runAction = (action: () => void) => {
    action()
    setMenuOpen(false)
  }

  const menuPortal = menuOpen
    ? createPortal(
        <div
          data-message-menu
          className="fixed z-[9999]"
          style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
        >
          <div className="mb-1 flex items-center gap-0.5 rounded-full border border-roll-gray-200 bg-white px-2 py-1.5 shadow-lg">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pickReaction(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-110 hover:bg-roll-gray-100"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onNotice('Mais emojis em breve.')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-roll-gray-400 hover:bg-roll-gray-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-roll-gray-200 bg-white py-1 shadow-lg">
            {menuItems.map(({ id, label, icon: Icon, action, danger }) => (
              <button
                key={id}
                type="button"
                onClick={() => runAction(action)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-roll-gray-50 ${
                  danger ? 'text-red-600' : 'text-roll-gray-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[#54656f]" />
                {label}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null

  const renderMediaFallback = (label: string) => (
    <div className="flex min-w-[240px] flex-col items-center gap-2 py-2">
      <span className="text-sm text-[#667781]">{label}</span>
      <button
        type="button"
        onClick={() => void loadMedia()}
        className="rounded-full bg-[#25d366] px-3 py-1 text-xs font-medium text-white hover:bg-[#20bd5a]"
      >
        Tentar novamente
      </button>
    </div>
  )

  const renderContent = () => {
    if (isImage) {
      if (mediaUrl) {
        return (
          <ChatImageContent
            src={mediaUrl}
            alt={caption || 'Imagem'}
            caption={caption}
            timeLabel={timeLabel}
            sent={sent}
            onOpen={() => setLightboxOpen(true)}
          />
        )
      }

      if (mediaLoading) {
        return (
          <ChatImageContent
            src=""
            alt=""
            timeLabel={timeLabel}
            sent={sent}
            loading
            onOpen={() => {}}
          />
        )
      }

      if (mediaFailed) {
        return renderMediaFallback('Não foi possível carregar a imagem')
      }

      return (
        <ChatImageContent
          src=""
          alt=""
          timeLabel={timeLabel}
          sent={sent}
          loading
          onOpen={() => {}}
        />
      )
    }

    if (isAudio) {
      if (mediaUrl) {
        return (
          <WhatsAppAudioPlayer
            src={mediaUrl}
            sent={sent}
            contactName={sent ? 'Você' : contactName}
            timeLabel={timeLabel}
          />
        )
      }

      if (mediaLoading) {
        return (
          <div className="flex min-w-[280px] items-center gap-3 py-2">
            <div className="h-[50px] w-[50px] animate-pulse rounded-full bg-[#dfe5e7]" />
            <div className="flex-1 space-y-2">
              <div className="h-2 w-full animate-pulse rounded bg-[#dfe5e7]" />
              <div className="h-2 w-16 animate-pulse rounded bg-[#dfe5e7]" />
            </div>
          </div>
        )
      }

      if (mediaFailed) {
        return renderMediaFallback('Não foi possível carregar o áudio')
      }

      return (
        <div className="flex min-w-[280px] items-center gap-3 py-2">
          <div className="h-[50px] w-[50px] animate-pulse rounded-full bg-[#dfe5e7]" />
          <span className="text-sm text-[#667781]">Carregando áudio...</span>
        </div>
      )
    }

    return (
      <p className="whitespace-pre-wrap break-words px-0.5 text-[14.2px] leading-[19px]">{body}</p>
    )
  }

  return (
    <div className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
      <div
        ref={containerRef}
        className={`group relative pr-7 ${isMedia ? 'max-w-[min(85%,360px)]' : 'max-w-[65%]'}`}
      >
        {reaction && (
          <span className="absolute -bottom-2 left-3 z-10 rounded-full border border-white bg-white px-1.5 py-0.5 text-sm shadow-sm">
            {reaction}
          </span>
        )}

        <div
          className={`shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
            isImage ? 'overflow-hidden rounded-[7.5px] p-0' : 'rounded-lg px-2 py-1'
          } ${
            sent
              ? `${isImage ? '' : 'rounded-tr-none'} bg-[#d9fdd3] text-[#111b21]`
              : `${isImage ? '' : 'rounded-tl-none'} bg-white text-[#111b21]`
          }`}
        >
          {isImage ? (
            <div className={sent ? 'bg-[#d9fdd3] p-0.5' : 'bg-white p-0.5'}>
              {renderContent()}
            </div>
          ) : (
            renderContent()
          )}

          {!isMedia && (
            <p className="mt-0.5 px-0.5 text-right text-[11px] leading-none text-[#667781]">{timeLabel}</p>
          )}
        </div>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setMenuOpen((open) => {
              const next = !open
              if (next) {
                requestAnimationFrame(updateMenuPosition)
              }
              return next
            })
          }}
          className={`absolute -right-1 top-0 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[#54656f] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 ${
            menuOpen ? 'opacity-100' : ''
          }`}
          aria-label="Opções da mensagem"
          aria-expanded={menuOpen}
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        {menuPortal}
        {lightboxOpen && mediaUrl && (
          <ImageLightbox
            src={mediaUrl}
            alt={caption || 'Imagem'}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
