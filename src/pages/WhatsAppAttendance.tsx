import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { MoreVertical, Paperclip, Plus, Search, Send, StickyNote, X } from 'lucide-react'
import virtualAttendantOn from '@/assets/virtual-attendant-on.png'
import virtualAttendantOff from '@/assets/virtual-attendant-off.png'
import whatsappChatBg from '@/assets/whatsapp-chat-bg.png'
import iconTag from '@/assets/icon-tag.png'
import { CrmStageShortcut } from '@/components/whatsapp/CrmDropdownMenu'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

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

const MOCK_CONVERSATIONS = [
  {
    id: '1',
    name: 'Ana Paula Mendes',
    time: '14:02',
    preview: 'Olá, gostaria de um orçamento para troca de pastilhas do meu carro...',
    tags: ['cotacao', 'em_conversa'] as TagKey[],
    aiEnabled: true,
  },
  {
    id: '2',
    name: 'Carlos Eduardo',
    time: '11:47',
    preview: 'Pode me enviar o catálogo completo de produtos?',
    tags: ['em_conversa'] as TagKey[],
    aiEnabled: true,
  },
  {
    id: '3',
    name: 'Fernanda Lima',
    time: 'Ontem',
    preview: 'A cotação ficou ótima, vou analisar com meu marido e retorno.',
    tags: ['cotacao_feita'] as TagKey[],
    aiEnabled: false,
  },
  {
    id: '4',
    name: 'Roberto Silva',
    time: 'Ontem',
    preview: 'Não tenho interesse no momento, obrigado pelo contato.',
    tags: ['nao_quer'] as TagKey[],
    aiEnabled: false,
  },
  {
    id: '5',
    name: 'Juliana Costa',
    time: '12/06',
    preview: 'Bom dia! Vocês atendem em São José dos Campos?',
    tags: ['cotacao'] as TagKey[],
    aiEnabled: true,
  },
]

const MOCK_MESSAGES = [
  {
    id: '1',
    text: 'Olá, bom dia! Gostaria de um orçamento para troca de pastilhas.',
    sent: false,
    time: '13:48',
  },
  {
    id: '2',
    text: 'É para um Fiat Argo 2021.',
    sent: false,
    time: '13:49',
  },
  {
    id: '3',
    text: 'Bom dia, Ana! Claro, posso te ajudar. Qual a cidade?',
    sent: true,
    time: '13:52',
  },
  {
    id: '4',
    text: 'Sou de Campinas, SP.',
    sent: false,
    time: '13:55',
  },
  {
    id: '5',
    text: 'Perfeito! Vou preparar a cotação e te envio em instantes.',
    sent: true,
    time: '14:02',
  },
]

const INITIAL_SELECTED_CONTACT = {
  name: 'Ana Paula Mendes',
  phone: '(19) 99876-5432',
  email: 'ana.paula@email.com',
  location: 'Campinas, SP',
  tags: ['cotacao', 'em_conversa'] as TagKey[],
  status: 'Em atendimento',
  activeFlow: 'Cotação — pastilhas de freio',
  notes: 'Cliente com Fiat Argo 2021. Aguardando valores de pastilhas dianteiras e traseiras.',
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
}: {
  conversations: typeof MOCK_CONVERSATIONS
  selectedId: string
  virtualAttendantOn: boolean
}) {
  return (
    <div className="flex h-full flex-col border-r border-roll-gray-200 bg-roll-gray-50/50">
      <div className="border-b border-roll-gray-200 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-roll-gray-400" />
          <input
            type="text"
            readOnly
            placeholder="Buscar conversa"
            className="w-full rounded-lg border border-roll-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-roll-gray-900 placeholder:text-roll-gray-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const isSelected = conversation.id === selectedId
          const aiActive = isSelected ? virtualAttendantOn : conversation.aiEnabled

          return (
          <div
            key={conversation.id}
            className={`relative cursor-default border-b border-roll-gray-100 border-l-4 px-3 py-3 transition-colors ${
              aiActive ? 'border-l-roll-orange pl-[calc(0.75rem-4px)]' : 'border-l-transparent'
            } ${isSelected ? 'bg-orange-50/80' : 'bg-white hover:bg-white'}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-roll-gray-900">{conversation.name}</p>
              <span className="shrink-0 text-[11px] text-roll-gray-400">{conversation.time}</span>
            </div>
            <p className="mb-2 truncate text-xs text-roll-gray-500">{conversation.preview}</p>
            <div className="flex flex-wrap gap-1">
              {conversation.tags.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          </div>
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
  savedNote,
  onOpenNote,
}: {
  savedNote: string | null
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
            {savedNote ? 'Bloco de notas' : 'Criar bloco de notas'}
          </button>
          {savedNote && (
            <p className="border-t border-roll-gray-100 px-4 py-2 text-xs text-roll-gray-400">
              Nota salva nesta conversa
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
  initialText = '',
}: {
  open: boolean
  onClose: () => void
  onSave: (text: string) => void
  initialText?: string
}) {
  const [text, setText] = useState(initialText)
  const isEditing = Boolean(initialText)

  useEffect(() => {
    if (open) setText(initialText)
  }, [open, initialText])

  const handleSave = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSave(trimmed)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Bloco de notas' : 'Criar bloco de notas'} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-roll-gray-500">
          {isEditing
            ? 'A nota fica salva aqui. Ao salvar, ela volta a aparecer no topo do chat.'
            : 'A nota ficará visível no topo da conversa para referência rápida.'}
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
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">Bloco de notas</p>
          <p className="mt-0.5 text-sm leading-snug text-amber-950">{text}</p>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="shrink-0 rounded-md p-1 text-amber-700/70 transition-colors hover:bg-amber-200/60 hover:text-amber-900"
          aria-label="Ocultar bloco de notas no chat"
          title="Ocultar no chat (a nota continua salva no menu)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function MessageWindow({
  contact,
  onContactNameChange,
  virtualAttendantOn,
  onVirtualAttendantChange,
  onOpenContactPanel,
  savedNote,
  showNoteBanner,
  onHideNoteBanner,
  onOpenNote,
  onSaveTags,
}: {
  contact: typeof INITIAL_SELECTED_CONTACT
  onContactNameChange: (name: string) => void
  virtualAttendantOn: boolean
  onVirtualAttendantChange: (value: boolean) => void
  onOpenContactPanel: () => void
  savedNote: string | null
  showNoteBanner: boolean
  onHideNoteBanner: () => void
  onOpenNote: () => void
  onSaveTags: (tags: TagKey[]) => void
}) {
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
              notes: contact.notes,
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
          <ChatOptionsMenu savedNote={savedNote} onOpenNote={onOpenNote} />
        </div>
      </div>

      {showNoteBanner && savedNote && <FloatingNoteBanner text={savedNote} onHide={onHideNoteBanner} />}

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
        {MOCK_MESSAGES.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sent ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[65%] rounded-lg px-2 py-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
                message.sent
                  ? 'rounded-tr-none bg-[#d9fdd3] text-[#111b21]'
                  : 'rounded-tl-none bg-white text-[#111b21]'
              }`}
            >
              <p className="text-[14.2px] leading-[19px]">{message.text}</p>
              <p className="mt-0.5 text-right text-[11px] leading-none text-[#667781]">{message.time}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-roll-gray-200 bg-[#f0f2f5] px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-roll-gray-400 transition-colors hover:bg-roll-gray-100 hover:text-roll-gray-600"
            aria-label="Anexar arquivo"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            type="text"
            readOnly
            placeholder="Escreva uma mensagem..."
            className="min-w-0 flex-1 rounded-lg border-0 bg-white px-4 py-2.5 text-sm text-roll-gray-900 shadow-sm placeholder:text-roll-gray-400"
          />
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-roll-orange text-white shadow-sm transition-colors hover:bg-roll-orange-dark"
            aria-label="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </button>
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
}: {
  contact: typeof INITIAL_SELECTED_CONTACT
  onContactNameChange: (name: string) => void
  virtualAttendantOn: boolean
  onClose: () => void
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
          <textarea
            readOnly
            value={contact.notes}
            rows={4}
            className="w-full resize-none rounded-lg border border-roll-gray-200 bg-roll-gray-50 px-3 py-2 text-sm text-roll-gray-700 placeholder:text-roll-gray-400"
            placeholder="Adicionar observações sobre o cliente..."
          />
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
  const [virtualAttendantOn, setVirtualAttendantOn] = useState(true)
  const [contactPanelOpen, setContactPanelOpen] = useState(false)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [contact, setContact] = useState(INITIAL_SELECTED_CONTACT)
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS)
  const [conversationNotes, setConversationNotes] = useState<Record<string, string>>({})
  const [noteBannerHidden, setNoteBannerHidden] = useState<Record<string, boolean>>({})
  const selectedConversationId = '1'

  const savedNote = conversationNotes[selectedConversationId] ?? null
  const showNoteBanner = Boolean(savedNote && !noteBannerHidden[selectedConversationId])

  const handleContactNameChange = (name: string) => {
    setContact((prev) => ({ ...prev, name }))
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversationId ? { ...conversation, name } : conversation,
      ),
    )
  }

  const handleSaveNote = (text: string) => {
    setConversationNotes((prev) => ({
      ...prev,
      [selectedConversationId]: text,
    }))
    setNoteBannerHidden((prev) => ({
      ...prev,
      [selectedConversationId]: false,
    }))
  }

  const handleHideNoteBanner = () => {
    setNoteBannerHidden((prev) => ({
      ...prev,
      [selectedConversationId]: true,
    }))
  }

  const handleSaveTags = (tags: TagKey[]) => {
    setContact((prev) => ({ ...prev, tags }))
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversationId ? { ...conversation, tags } : conversation,
      ),
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
              selectedId={selectedConversationId}
              virtualAttendantOn={virtualAttendantOn}
            />
          </div>

          <div className="min-h-0 min-w-0">
            <MessageWindow
              contact={contact}
              onContactNameChange={handleContactNameChange}
              virtualAttendantOn={virtualAttendantOn}
              onVirtualAttendantChange={setVirtualAttendantOn}
              onOpenContactPanel={() => setContactPanelOpen(true)}
              savedNote={savedNote}
              showNoteBanner={showNoteBanner}
              onHideNoteBanner={handleHideNoteBanner}
              onOpenNote={() => setNoteModalOpen(true)}
              onSaveTags={handleSaveTags}
            />
          </div>

          {contactPanelOpen && (
            <div className="hidden min-h-0 lg:block">
              <ContactPanel
                contact={contact}
                onContactNameChange={handleContactNameChange}
                virtualAttendantOn={virtualAttendantOn}
                onClose={() => setContactPanelOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      <NoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        onSave={handleSaveNote}
        initialText={savedNote ?? ''}
      />
    </div>
  )
}
