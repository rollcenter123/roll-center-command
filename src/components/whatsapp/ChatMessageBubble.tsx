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

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
const MENU_WIDTH = 220

interface ChatMessageBubbleProps {
  message: WhatsAppMessage
  timeLabel: string
  reaction?: string
  onReact: (messageId: string, emoji: string) => void
  onReply: (message: WhatsAppMessage) => void
  onCopy: (text: string) => void
  onNotice: (text: string) => void
}

export function ChatMessageBubble({
  message,
  timeLabel,
  reaction,
  onReact,
  onReply,
  onCopy,
  onNotice,
}: ChatMessageBubbleProps) {
  const sent = message.direction === 'outbound'
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

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

  const menuItems: {
    id: string
    label: string
    icon: typeof Reply
    action: () => void
    danger?: boolean
  }[] = [
    { id: 'reply', label: 'Responder', icon: Reply, action: () => onReply(message) },
    { id: 'copy', label: 'Copiar', icon: Copy, action: () => onCopy(body) },
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

  return (
    <div className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
      <div ref={containerRef} className="group relative max-w-[65%] pr-7">
        {reaction && (
          <span className="absolute -bottom-2 left-3 z-10 rounded-full border border-white bg-white px-1.5 py-0.5 text-sm shadow-sm">
            {reaction}
          </span>
        )}

        <div
          className={`rounded-lg px-2 py-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
            sent
              ? 'rounded-tr-none bg-[#d9fdd3] text-[#111b21]'
              : 'rounded-tl-none bg-white text-[#111b21]'
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">{body}</p>
          <p className="mt-0.5 text-right text-[11px] leading-none text-[#667781]">{timeLabel}</p>
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
      </div>
    </div>
  )
}
