import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { MoreVertical, Mic, Paperclip, Plus, Search, Send, SpellCheck, FileText, Bot, StickyNote, X, ImageIcon } from 'lucide-react'
import virtualAttendantOn from '@/assets/virtual-attendant-on.png'
import virtualAttendantOff from '@/assets/virtual-attendant-off.png'
import whatsappChatBg from '@/assets/whatsapp-chat-bg.png'
import iconTag from '@/assets/icon-tag.png'
import { CrmStageShortcut } from '@/components/whatsapp/CrmDropdownMenu'
import { ChatMessageBubble } from '@/components/whatsapp/ChatMessageBubble'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useWhatsAppInbox } from '@/hooks/useWhatsAppInbox'
import { formatPhone } from '@/lib/utils'
import { correctChatMessage } from '@/lib/spellcheck'
import {
  appendConversationNote,
  formatNoteDate,
  getLatestConversationNote,
  parseConversationNotes,
  removeConversationNote,
  type ConversationNote,
} from '@/lib/conversation-notes'
import type { WhatsAppConversation, WhatsAppMessage } from '@/types/database'

type TagKey = 'cotacao' | 'em_conversa' | 'cotacao_feita' | 'nao_quer'

const TAG_STYLES: Record<TagKey, string> = {
  cotacao: 'bg-blue-50 text-blue-700 ring-blue-200',
  em_conversa: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cotacao_feita: 'bg-violet-50 text-violet-700 ring-violet-200',
  nao_quer: 'bg-roll-gray-100 text-roll-gray-600 ring-roll-gray-200',
}

const TAG_LABELS: Record<TagKey, string> = {
  cotacao: 'cotação',
  em_conversa: 'em conversa',
  cotacao_feita: 'cotação feita',
  nao_quer: 'não quer',
}

function TagPill({ tag }: { tag: TagKey }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TAG_STYLES[tag]}`}
    >
      {TAG_LABELS[tag]}
    </span>
  )
}

function Avatar({
  name,
  size = 'md',
  onClick,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg',
  }

  const className = `flex shrink-0 items-center justify-center rounded-full bg-roll-orange/10 font-semibold text-roll-orange ${sizes[size]} ${
    onClick ? 'cursor-pointer transition-shadow hover:ring-2 hover:ring-roll-orange/40' : ''
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-label="Ver detalhes do contato">
        {initials}
      </button>
    )
  }

  return <div className={className}>{initials}</div>
}

function formatChatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return 'Ontem'

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface ContactView {
  name: string
  phone: string
  email: string
  location: string
  tags: TagKey[]
  status: string
  activeFlow: string
  notesRaw: string | null
  conversationNotes: ConversationNote[]
}

const EMPTY_CONTACT: ContactView = {
  name: 'Selecione uma conversa',
  phone: '—',
  email: '—',
  location: '—',
  tags: [],
  status: '—',
  activeFlow: 'Nenhum',
  notesRaw: null,
  conversationNotes: [],
}

function EditableContactName({
  value,
  onChange,
  className = '',
  inputClassName = '',
}: {
  value: string
  onChange: (name: string) => void
  className?: string
  inputClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const startEditing = () => {
    setDraft(value)
    setEditing(true)
  }

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') cancel()
        }}
        className={`w-full rounded-md border border-roll-orange bg-white px-2 py-0.5 text-sm font-semibold text-roll-gray-900 outline-none ring-2 ring-roll-orange/20 ${inputClassName}`}
        aria-label="Editar nome do cliente"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={`truncate text-left transition-colors hover:text-roll-orange ${className}`}
      title="Clique para editar o nome"
    >
      {value}
    </button>
  )
}

function ConversationList({
  conversations,
  selectedId,
  virtualAttendantOn,
  onSelect,
  search,
  onSearchChange,
}: {
  conversations: WhatsAppConversation[]
  selectedId: string | null
  virtualAttendantOn: boolean
  onSelect: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
}) {
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((conversation) => {
      const name = conversation.display_name?.toLowerCase() ?? ''
      const phone = conversation.wa_phone
      const preview = conversation.last_message_preview?.toLowerCase() ?? ''
      return name.includes(term) || phone.includes(term) || preview.includes(term)
    })
  }, [conversations, search])

  return (
    <div className="flex h-full flex-col border-r border-roll-gray-200 bg-roll-gray-50/50">
      <div className="border-b border-roll-gray-200 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-roll-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversa"
            className="w-full rounded-lg border border-roll-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-roll-gray-900 placeholder:text-roll-gray-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-roll-gray-400">
            Nenhuma conversa ainda. Mensagens recebidas no webhook aparecem aqui ao vivo.
          </p>
        )}
        {filtered.map((conversation) => {
          const isSelected = conversation.id === selectedId
          const aiActive = isSelected ? virtualAttendantOn : conversation.ai_enabled
          const name = conversation.display_name ?? formatPhone(conversation.wa_phone)

          return (
          <button
            type="button"
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`relative w-full border-b border-roll-gray-100 border-l-4 px-3 py-3 text-left transition-colors ${
              aiActive ? 'border-l-roll-orange pl-[calc(0.75rem-4px)]' : 'border-l-transparent'
            } ${isSelected ? 'bg-orange-50/80' : 'bg-white hover:bg-orange-50/40'}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-roll-gray-900">{name}</p>
              <span className="shrink-0 text-[11px] text-roll-gray-400">
                {formatChatTime(conversation.last_message_at)}
              </span>
            </div>
            <p className="mb-2 truncate text-xs text-roll-gray-500">
              {conversation.last_message_preview ?? 'Sem mensagens'}
            </p>
            {conversation.unread_count > 0 && (
              <span className="absolute right-3 top-3 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-roll-orange px-1.5 text-[10px] font-semibold text-white">
                {conversation.unread_count}
              </span>
            )}
          </button>
          )
        })}
      </div>
    </div>
  )
}

function VirtualAttendantAvatar({ active, size = 'md' }: { active: boolean; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10'
  return (
    <img
      src={active ? virtualAttendantOn : virtualAttendantOff}
      alt=""
      draggable={false}
      className={`${sizeClass} object-contain object-center`}
    />
  )
}

const ALL_TAG_KEYS = Object.keys(TAG_LABELS) as TagKey[]

function useClickOutside(ref: RefObject<HTMLElement | null>, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [active, onClose, ref])
}

function ChatOptionsMenu({
  hasNotes,
  onOpenNote,
}: {
  hasNotes: boolean
  onOpenNote: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside(menuRef, () => setOpen(false), open)

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-roll-gray-500 transition-colors hover:bg-roll-gray-200 hover:text-roll-gray-700"
        aria-label="Opções da conversa"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-roll-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onOpenNote()
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-roll-gray-700 transition-colors hover:bg-roll-gray-50"
          >
            <StickyNote className="h-4 w-4 text-roll-orange" />
            {hasNotes ? 'Bloco de notas' : 'Criar bloco de notas'}
          </button>
          {hasNotes && (
            <p className="border-t border-roll-gray-100 px-4 py-2 text-xs text-roll-gray-400">
              Notas salvas nesta conversa
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function NoteModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (text: string) => void
}) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (open) setText('')
  }, [open])

  const handleSave = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSave(trimmed)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova nota" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-roll-gray-500">
          A nota será adicionada ao perfil do cliente e exibida no topo do chat. Fechar o aviso no chat não apaga a nota.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Escreva sua nota..."
          className="w-full resize-none rounded-lg border border-roll-gray-300 bg-white px-3 py-2 text-sm text-roll-gray-900 placeholder:text-roll-gray-400 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!text.trim()}>
            Salvar nota
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function HeaderImageDropdown({
  label,
  imageSrc,
  children,
  onOpenChange,
}: {
  label: string
  imageSrc: string
  children: ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside(menuRef, () => {
    setOpen(false)
    onOpenChange?.(false)
  }, open)

  const toggle = () => {
    setOpen((value) => {
      const next = !value
      onOpenChange?.(next)
      return next
    })
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center border-0 bg-transparent p-0 outline-none transition-transform active:scale-90"
        aria-label={label}
        aria-expanded={open}
      >
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          className="pointer-events-none h-6 w-6 object-contain object-center"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border border-roll-gray-200 bg-white p-3 shadow-lg">
          {children}
        </div>
      )}
    </div>
  )
}

function TagsDropdownMenu({
  selectedTags,
  onChange,
}: {
  selectedTags: TagKey[]
  onChange: (tags: TagKey[]) => void
}) {
  const toggleTag = (tag: TagKey) => {
    onChange(selectedTags.includes(tag) ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag])
  }

  return (
    <HeaderImageDropdown label="Gerenciar tags" imageSrc={iconTag}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-roll-gray-400">Tags do cliente</p>
      <div className="flex flex-wrap gap-1.5">
        {ALL_TAG_KEYS.map((tag) => {
          const active = selectedTags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-transform active:scale-95 ${
                active
                  ? TAG_STYLES[tag]
                  : 'bg-white text-roll-gray-500 ring-roll-gray-200'
              }`}
            >
              {TAG_LABELS[tag]}
            </button>
          )
        })}
      </div>
    </HeaderImageDropdown>
  )
}

function FloatingNoteBanner({ text, onHide }: { text: string; onHide: () => void }) {
  return (
    <div className="border-b border-amber-200/80 bg-[#fff9c4] px-4 py-2.5 shadow-sm">
      <div className="flex items-start gap-3">
        <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">Nota mais recente</p>
          <p className="mt-0.5 text-sm leading-snug text-amber-950">{text}</p>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="shrink-0 rounded-md p-1 text-amber-700/70 transition-colors hover:bg-amber-200/60 hover:text-amber-900"
          aria-label="Fechar aviso da nota no chat"
          title="Fechar aviso (a nota continua no perfil do cliente)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function ComposeAttachMenu({
  disabled,
  sending,
  onPickImage,
}: {
  disabled: boolean
  sending: boolean
  onPickImage: (file: File) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useClickOutside(menuRef, () => setOpen(false), open)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setOpen(false)
    onPickImage(file)
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        disabled={disabled || sending}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-roll-gray-400 transition-colors hover:bg-roll-gray-100 hover:text-roll-gray-600 disabled:opacity-40"
        aria-label="Anexar arquivo"
        aria-expanded={open}
      >
        <Paperclip className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 min-w-[200px] overflow-hidden rounded-lg border border-roll-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-roll-gray-700 transition-colors hover:bg-roll-gray-50"
          >
            <ImageIcon className="h-4 w-4 shrink-0 text-roll-orange" />
            Fotos e vídeos
          </button>
        </div>
      )}
    </div>
  )
}

function ComposePlusMenu({
  disabled,
  spellChecking,
  onSpellCheck,
  onSendTemplate,
  onStartAiConversation,
}: {
  disabled: boolean
  spellChecking: boolean
  onSpellCheck: () => void
  onSendTemplate: () => void
  onStartAiConversation: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside(menuRef, () => setOpen(false), open)

  const items = [
    {
      id: 'spellcheck',
      label: 'Corrigir e formalizar',
      icon: SpellCheck,
      action: onSpellCheck,
    },
    {
      id: 'template',
      label: 'Enviar template',
      icon: FileText,
      action: onSendTemplate,
    },
    {
      id: 'ai',
      label: 'Iniciar conversa com IA',
      icon: Bot,
      action: onStartAiConversation,
    },
  ] as const

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-roll-gray-500 transition-colors hover:bg-roll-gray-100 hover:text-roll-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Mais opções de mensagem"
        aria-expanded={open}
      >
        <Plus className={`h-5 w-5 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 min-w-[220px] overflow-hidden rounded-lg border border-roll-gray-200 bg-white py-1 shadow-lg">
          {items.map(({ id, label, icon: Icon, action }) => (
            <button
              key={id}
              type="button"
              disabled={id === 'spellcheck' && spellChecking}
              onClick={() => {
                setOpen(false)
                action()
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-roll-gray-700 transition-colors hover:bg-roll-gray-50 disabled:opacity-50"
            >
              {id === 'spellcheck' && spellChecking ? (
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-roll-orange border-t-transparent" />
              ) : (
                <Icon className="h-4 w-4 shrink-0 text-roll-orange" />
              )}
              {id === 'spellcheck' && spellChecking ? 'Corrigindo...' : label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageWindow({
  contact,
  messages,
  messagesLoading,
  messagesEndRef,
  draft,
  onDraftChange,
  onSend,
  sending,
  sendError,
  canSend,
  onContactNameChange,
  virtualAttendantOn,
  onVirtualAttendantChange,
  onOpenContactPanel,
  onOpenNote,
  onSaveTags,
  onSpellCheck,
  onSendTemplate,
  onStartAiConversation,
  spellChecking,
  messageReactions,
  onMessageReact,
  onMessageReply,
  onMessageNotice,
  replyingTo,
  onCancelReply,
  onRecordAudio,
  onPickImage,
  hasNotes,
  latestNoteText,
  showNoteBanner,
  onHideNoteBanner,
}: {
  contact: ContactView
  messages: WhatsAppMessage[]
  messagesLoading: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  sending: boolean
  sendError: string | null
  canSend: boolean
  onContactNameChange: (name: string) => void
  virtualAttendantOn: boolean
  onVirtualAttendantChange: (value: boolean) => void
  onOpenContactPanel: () => void
  hasNotes: boolean
  latestNoteText: string | null
  showNoteBanner: boolean
  onHideNoteBanner: () => void
  onOpenNote: () => void
  onSaveTags: (tags: TagKey[]) => void
  onSpellCheck: () => void
  onSendTemplate: () => void
  onStartAiConversation: () => void
  spellChecking: boolean
  messageReactions: Record<string, string>
  onMessageReact: (messageId: string, emoji: string) => void
  onMessageReply: (message: WhatsAppMessage) => void
  onMessageNotice: (text: string) => void
  replyingTo: WhatsAppMessage | null
  onCancelReply: () => void
  onRecordAudio: () => void
  onPickImage: (file: File) => void
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-roll-gray-200 bg-[#f0f2f5] px-4 py-3">
        <Avatar name={contact.name} onClick={onOpenContactPanel} />
        <div className="min-w-0 flex-1">
          <EditableContactName
            value={contact.name}
            onChange={onContactNameChange}
            className="block w-full font-semibold text-roll-gray-900"
          />
          <p className="truncate text-xs text-roll-gray-500">{contact.phone}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <TagsDropdownMenu selectedTags={contact.tags} onChange={onSaveTags} />
          <CrmStageShortcut
            contact={{
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              notes: contact.conversationNotes.map((note) => note.text).join('\n\n'),
            }}
          />
          <button
            type="button"
            onClick={() => onVirtualAttendantChange(!virtualAttendantOn)}
            title={virtualAttendantOn ? 'Atendente virtual ligada' : 'Atendente virtual desligada'}
            aria-label={virtualAttendantOn ? 'Desligar atendente virtual' : 'Ligar atendente virtual'}
            aria-pressed={virtualAttendantOn}
            className="shrink-0 rounded-full p-0.5 transition-opacity hover:opacity-80"
          >
            <VirtualAttendantAvatar active={virtualAttendantOn} size="sm" />
          </button>
          <ChatOptionsMenu hasNotes={hasNotes} onOpenNote={onOpenNote} />
        </div>
      </div>

      {showNoteBanner && latestNoteText && (
        <FloatingNoteBanner text={latestNoteText} onHide={onHideNoteBanner} />
      )}

      <div
        className="flex-1 space-y-1 overflow-y-auto px-[5%] py-3 sm:px-[7%]"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: `url(${whatsappChatBg})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      >
        {messagesLoading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
          </div>
        )}
        {!messagesLoading && messages.length === 0 && (
          <p className="py-12 text-center text-sm text-[#667781]">
            Nenhuma mensagem nesta conversa ainda.
          </p>
        )}
        {messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            timeLabel={formatChatTime(message.sent_at)}
            reaction={messageReactions[message.id]}
            onReact={onMessageReact}
            onReply={onMessageReply}
            onCopy={(text) => {
              void navigator.clipboard.writeText(text)
              onMessageNotice('Mensagem copiada.')
            }}
            onNotice={onMessageNotice}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-roll-gray-200 bg-[#f0f2f5] px-4 py-3">
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-roll-orange bg-white px-3 py-2 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-roll-orange">
                {replyingTo.direction === 'outbound' ? 'Você' : contact.name}
              </p>
              <p className="truncate text-sm text-roll-gray-600">
                {replyingTo.body ?? `[${replyingTo.message_type}]`}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="shrink-0 rounded-full p-1 text-roll-gray-400 hover:bg-roll-gray-100 hover:text-roll-gray-600"
              aria-label="Cancelar resposta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {sendError && (
          <p className="mb-2 text-center text-xs text-red-600">{sendError}</p>
        )}
        <div className="flex items-center gap-2">
          <ComposeAttachMenu
            disabled={!canSend}
            sending={sending}
            onPickImage={onPickImage}
          />
          <div className="relative flex min-w-0 flex-1 items-center rounded-lg bg-white shadow-sm">
            <ComposePlusMenu
              disabled={!canSend || sending || spellChecking}
              spellChecking={spellChecking}
              onSpellCheck={onSpellCheck}
              onSendTemplate={onSendTemplate}
              onStartAiConversation={onStartAiConversation}
            />
            <input
              type="text"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canSend || sending}
              placeholder={canSend ? 'Escreva uma mensagem...' : 'Selecione uma conversa'}
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pl-1 pr-4 text-sm text-roll-gray-900 placeholder:text-roll-gray-400 focus:outline-none disabled:text-roll-gray-400"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend || sending || !draft.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-roll-orange text-white shadow-sm transition-colors hover:bg-roll-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Enviar mensagem"
            >
              {sending ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onRecordAudio}
              disabled={!canSend || sending}
              className="flex h-9 w-9 items-center justify-center rounded-full text-roll-gray-500 transition-colors hover:bg-roll-gray-200 hover:text-roll-gray-700 disabled:opacity-40"
              aria-label="Gravar áudio"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactPanel({
  contact,
  onContactNameChange,
  virtualAttendantOn,
  onClose,
  onDeleteNote,
}: {
  contact: ContactView
  onContactNameChange: (name: string) => void
  virtualAttendantOn: boolean
  onClose: () => void
  onDeleteNote: (noteId: string) => void
}) {
  return (
    <div className="flex h-full flex-col border-l border-roll-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-roll-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-roll-gray-900">Detalhes do contato</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-roll-gray-400 transition-colors hover:bg-roll-gray-100 hover:text-roll-gray-600"
          aria-label="Fechar painel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-roll-gray-100 px-4 py-5 text-center">
        <div className="mb-3 flex justify-center">
          <Avatar name={contact.name} size="lg" />
        </div>
        <EditableContactName
          value={contact.name}
          onChange={onContactNameChange}
          className="mx-auto block max-w-full font-semibold text-roll-gray-900"
          inputClassName="text-center"
        />
        <p className="text-sm text-roll-gray-500">{contact.location}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-roll-gray-400">
            Atendente virtual
          </h3>
          <div className="flex items-center gap-3 rounded-lg border border-roll-gray-200 bg-roll-gray-50 px-3 py-2.5">
            <VirtualAttendantAvatar active={virtualAttendantOn} />
            <div>
              <p className="text-sm font-medium text-roll-gray-900">
                {virtualAttendantOn ? 'Ligada' : 'Desligada'}
              </p>
              <p className="text-xs text-roll-gray-500">
                {virtualAttendantOn ? 'Respondendo automaticamente' : 'Atendimento humano'}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-roll-gray-400">
            Fluxo ativo
          </h3>
          <div className="rounded-lg border border-roll-orange/30 bg-orange-50 px-3 py-2.5">
            <p className="text-sm font-medium text-roll-orange">{contact.activeFlow}</p>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-roll-gray-400">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-roll-gray-300 px-2 py-0.5 text-[10px] font-medium text-roll-gray-500 transition-colors hover:border-roll-orange hover:text-roll-orange"
            >
              <Plus className="h-3 w-3" />
              tag
            </button>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-roll-gray-400">Notas</h3>
          {contact.conversationNotes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-roll-gray-200 bg-roll-gray-50 px-3 py-4 text-sm text-roll-gray-400">
              Nenhuma nota nesta conversa.
            </p>
          ) : (
            <div className="space-y-3">
              {contact.conversationNotes.map((note) => {
                const dateLabel = formatNoteDate(note.createdAt)
                return (
                  <div
                    key={note.id}
                    className="rounded-lg border border-amber-200/80 bg-[#fff9c4] px-3 py-2.5 shadow-sm"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80">
                        {dateLabel || 'Nota salva'}
                      </p>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="shrink-0 rounded-md p-1 text-amber-700/70 transition-colors hover:bg-amber-200/60 hover:text-amber-900"
                        aria-label="Excluir nota"
                        title="Excluir nota permanentemente"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-snug text-amber-950">{note.text}</p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-roll-gray-400">
            Informações
          </h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-roll-gray-400">Telefone</dt>
              <dd className="font-medium text-roll-gray-900">{contact.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-roll-gray-400">E-mail</dt>
              <dd className="font-medium text-roll-gray-900">{contact.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-roll-gray-400">Status</dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
                  {contact.status}
                </span>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}

export function WhatsAppAttendancePage() {
  const {
    conversations,
    messages,
    selectedId,
    linkedClient,
    loading,
    messagesLoading,
    sending,
    sendError,
    selectConversation,
    updateConversation,
    sendMessage,
    sendImage,
    reactToMessage,
  } = useWhatsAppInbox()

  const [virtualAttendantOn, setVirtualAttendantOn] = useState(true)
  const [contactPanelOpen, setContactPanelOpen] = useState(false)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteBannerHidden, setNoteBannerHidden] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [localName, setLocalName] = useState<string | null>(null)
  const [localTags, setLocalTags] = useState<TagKey[]>([])
  const [draft, setDraft] = useState('')
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [composeNotice, setComposeNotice] = useState<string | null>(null)
  const [spellChecking, setSpellChecking] = useState(false)
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({})
  const [replyingTo, setReplyingTo] = useState<WhatsAppMessage | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedConversation = conversations.find((row) => row.id === selectedId) ?? null

  const conversationNotes = useMemo(
    () => parseConversationNotes(selectedConversation?.notes),
    [selectedConversation?.notes],
  )

  const contact = useMemo<ContactView>(() => {
    if (!selectedConversation) return EMPTY_CONTACT

    return {
      name: localName ?? selectedConversation.display_name ?? formatPhone(selectedConversation.wa_phone),
      phone: formatPhone(selectedConversation.wa_phone),
      email: linkedClient?.email ?? '—',
      location: linkedClient?.company ?? '—',
      tags: localTags,
      status: linkedClient ? 'Cliente cadastrado' : 'Contato via WhatsApp',
      activeFlow: 'Nenhum',
      notesRaw: selectedConversation.notes,
      conversationNotes,
    }
  }, [selectedConversation, linkedClient, localName, localTags, conversationNotes])

  const hasNotes = conversationNotes.length > 0
  const latestNote = getLatestConversationNote(selectedConversation?.notes)
  const latestNoteText = latestNote?.text ?? null
  const showNoteBanner = Boolean(
    selectedId && latestNoteText && !noteBannerHidden[selectedId],
  )

  useEffect(() => {
    setLocalName(null)
    setLocalTags([])
    setDraft('')
    setReplyingTo(null)
  }, [selectedId])

  useEffect(() => {
    if (selectedConversation) {
      setVirtualAttendantOn(selectedConversation.ai_enabled)
    }
  }, [selectedConversation?.id, selectedConversation?.ai_enabled])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId])

  const handleContactNameChange = (name: string) => {
    if (!selectedId) return
    setLocalName(name)
    void updateConversation(selectedId, { display_name: name })
  }

  const handleSaveNote = (text: string) => {
    if (!selectedId) return
    const nextNotes = appendConversationNote(selectedConversation?.notes, text)
    void updateConversation(selectedId, { notes: nextNotes })
    setNoteBannerHidden((prev) => ({
      ...prev,
      [selectedId]: false,
    }))
  }

  const handleDeleteNote = (noteId: string) => {
    if (!selectedId) return
    const nextNotes = removeConversationNote(selectedConversation?.notes, noteId)
    void updateConversation(selectedId, { notes: nextNotes || null })
  }

  const handleHideNoteBanner = () => {
    if (!selectedId) return
    setNoteBannerHidden((prev) => ({
      ...prev,
      [selectedId]: true,
    }))
  }

  const handleSaveTags = (tags: TagKey[]) => {
    setLocalTags(tags)
  }

  const handleVirtualAttendantChange = (value: boolean) => {
    setVirtualAttendantOn(value)
    if (selectedId) {
      void updateConversation(selectedId, { ai_enabled: value })
    }
  }

  const handleSend = async () => {
    if (!selectedId || !draft.trim() || sending) return
    const text = draft
    const ok = await sendMessage(selectedId, text)
    if (ok) {
      setDraft('')
      setReplyingTo(null)
    }
  }

  const handleMessageReact = async (messageId: string, emoji: string) => {
    if (!selectedId) return

    const message = messages.find((row) => row.id === messageId)
    if (!message) return

    if (message.direction !== 'inbound') {
      setComposeNotice('Reações pelo sistema só funcionam em mensagens recebidas do cliente.')
      return
    }

    const ok = await reactToMessage(selectedId, messageId, emoji)
    if (ok) {
      setMessageReactions((prev) => ({ ...prev, [messageId]: emoji }))
      setComposeNotice('Reação enviada no WhatsApp.')
    }
  }

  const handlePickImage = async (file: File) => {
    if (!selectedId || sending) return
    const ok = await sendImage(selectedId, file)
    if (ok) {
      setComposeNotice('Imagem enviada.')
    }
  }

  const handleMessageReply = (message: WhatsAppMessage) => {
    setReplyingTo(message)
  }

  const handleRecordAudio = () => {
    setComposeNotice('Gravação de áudio em breve.')
  }

  const handleSpellCheck = async () => {
    if (!draft.trim()) {
      setComposeNotice('Digite uma mensagem antes de corrigir.')
      return
    }

    setSpellChecking(true)
    try {
      const corrected = await correctChatMessage(draft)
      if (corrected === draft) {
        setComposeNotice('Nenhuma correção necessária.')
      } else {
        setDraft(corrected)
        setComposeNotice('Texto corrigido e formalizado.')
      }
    } catch {
      setComposeNotice('Não foi possível corrigir agora. Tente novamente.')
    } finally {
      setSpellChecking(false)
    }
  }

  const handleStartAiConversation = () => {
    handleVirtualAttendantChange(true)
    setComposeNotice('Atendente virtual ligado. A resposta automática será configurada em breve.')
  }

  useEffect(() => {
    if (!composeNotice) return
    const timer = window.setTimeout(() => setComposeNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [composeNotice])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="-mx-8 -mb-8 -mt-8 flex h-[calc(100vh-4rem)] flex-col">
      <div className="mx-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-roll-gray-200 bg-white shadow-sm">
        <div
          className={`grid min-h-0 flex-1 grid-cols-1 ${
            contactPanelOpen ? 'lg:grid-cols-[280px_1fr_260px]' : 'lg:grid-cols-[280px_1fr]'
          }`}
        >
          <div className="hidden min-h-0 lg:block">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              virtualAttendantOn={virtualAttendantOn}
              onSelect={selectConversation}
              search={search}
              onSearchChange={setSearch}
            />
          </div>

          <div className="min-h-0 min-w-0">
            <MessageWindow
              contact={contact}
              messages={messages}
              messagesLoading={messagesLoading}
              messagesEndRef={messagesEndRef}
              draft={draft}
              onDraftChange={setDraft}
              onSend={() => void handleSend()}
              sending={sending}
              sendError={sendError}
              canSend={Boolean(selectedId)}
              onContactNameChange={handleContactNameChange}
              virtualAttendantOn={virtualAttendantOn}
              onVirtualAttendantChange={handleVirtualAttendantChange}
              onOpenContactPanel={() => setContactPanelOpen(true)}
              hasNotes={hasNotes}
              latestNoteText={latestNoteText}
              showNoteBanner={showNoteBanner}
              onHideNoteBanner={handleHideNoteBanner}
              onOpenNote={() => setNoteModalOpen(true)}
              onSaveTags={handleSaveTags}
              onSpellCheck={() => void handleSpellCheck()}
              onSendTemplate={() => setTemplateModalOpen(true)}
              onStartAiConversation={handleStartAiConversation}
              spellChecking={spellChecking}
              messageReactions={messageReactions}
              onMessageReact={(messageId, emoji) => void handleMessageReact(messageId, emoji)}
              onMessageReply={handleMessageReply}
              onMessageNotice={setComposeNotice}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onRecordAudio={handleRecordAudio}
              onPickImage={(file) => void handlePickImage(file)}
            />
          </div>

          {contactPanelOpen && (
            <div className="hidden min-h-0 lg:block">
              <ContactPanel
                contact={contact}
                onContactNameChange={handleContactNameChange}
                virtualAttendantOn={virtualAttendantOn}
                onClose={() => setContactPanelOpen(false)}
                onDeleteNote={handleDeleteNote}
              />
            </div>
          )}
        </div>
      </div>

      <NoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        onSave={handleSaveNote}
      />

      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Enviar template"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-roll-gray-500">
            Selecione um template aprovado na Meta para enviar a {contact.name}.
          </p>
          <p className="rounded-lg border border-dashed border-roll-gray-200 bg-roll-gray-50 px-4 py-6 text-center text-sm text-roll-gray-400">
            Templates em breve — integração com WhatsApp Cloud API.
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setTemplateModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {composeNotice && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-roll-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {composeNotice}
        </div>
      )}
    </div>
  )
}
