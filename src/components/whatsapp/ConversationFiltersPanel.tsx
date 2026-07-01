import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Bot,
  Building2,
  ChevronRight,
  Eye,
  Filter,
  MessageCircle,
  Search,
  Tag,
  Users,
  X,
} from 'lucide-react'
import {
  fetchWhatsAppFunnels,
  fetchWhatsAppStages,
  WHATSAPP_CRM_QUERY_KEYS,
} from '@/lib/whatsapp-crm'
import { supabase } from '@/lib/supabase'
import {
  countActiveFilters,
  EMPTY_CONVERSATION_FILTERS,
  type ConversationFilters,
} from '@/lib/conversation-filters'
import {
  ALL_WHATSAPP_TAG_KEYS,
  WHATSAPP_TAG_LABELS,
  WHATSAPP_TAG_STYLES,
} from '@/lib/whatsapp-tags'
import { Button } from '@/components/ui/Button'

type FilterCategoryId =
  | 'team'
  | 'sectors'
  | 'tags'
  | 'crm'
  | 'automation'
  | 'read'
  | 'last_response'

interface FilterCategory {
  id: FilterCategoryId
  label: string
  icon: typeof Users
  iconClass: string
  disabled?: boolean
  soon?: boolean
}

const FILTER_CATEGORIES: FilterCategory[] = [
  { id: 'team', label: 'Membros de Equipe', icon: Users, iconClass: 'text-blue-500' },
  { id: 'sectors', label: 'Setores', icon: Building2, iconClass: 'text-violet-500', disabled: true, soon: true },
  { id: 'tags', label: 'TAGs', icon: Tag, iconClass: 'text-orange-500' },
  { id: 'crm', label: 'Etapas CRM', icon: BarChart3, iconClass: 'text-blue-600' },
  { id: 'automation', label: 'Automação', icon: Bot, iconClass: 'text-teal-500' },
  { id: 'read', label: 'Status de Leitura', icon: Eye, iconClass: 'text-violet-500' },
  { id: 'last_response', label: 'Última resposta por', icon: MessageCircle, iconClass: 'text-orange-500' },
]

function pickDefaultFunnelId(funnels: { id: string; name: string }[]): string | undefined {
  return (
    funnels.find((f) => f.name === 'Disparo Base')?.id
    ?? funnels.find((f) => f.name !== 'Atendimento Geral')?.id
    ?? funnels[0]?.id
  )
}

function isCategoryActive(category: FilterCategoryId, filters: ConversationFilters): boolean {
  if (category === 'crm') return Boolean(filters.crmFunnelId || filters.crmStageId)
  if (category === 'automation') return filters.automation !== null
  if (category === 'read') return filters.readStatus !== null
  if (category === 'last_response') return filters.lastResponseBy !== null
  if (category === 'team') return filters.teamMemberId !== null
  if (category === 'tags') return filters.tagKeys.length > 0
  return false
}

interface ConversationFiltersPanelProps {
  open: boolean
  filters: ConversationFilters
  onClose: () => void
  onApply: (filters: ConversationFilters) => void
}

export function ConversationFiltersButton({
  filters,
  onApply,
}: {
  filters: ConversationFilters
  onApply: (filters: ConversationFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = countActiveFilters(filters)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          activeCount > 0
            ? 'border-roll-orange bg-orange-50 text-roll-orange'
            : 'border-roll-gray-200 bg-white text-roll-gray-500 hover:bg-roll-gray-50'
        }`}
        title="Filtrar conversas"
        aria-label="Filtrar conversas"
      >
        <Filter className="h-4 w-4" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-roll-orange px-1 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      <ConversationFiltersPanel
        open={open}
        filters={filters}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          onApply(next)
          setOpen(false)
        }}
      />
    </>
  )
}

export function ConversationFiltersPanel({
  open,
  filters,
  onClose,
  onApply,
}: ConversationFiltersPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<ConversationFilters>(filters)
  const [activeCategory, setActiveCategory] = useState<FilterCategoryId>('crm')
  const [teamSearch, setTeamSearch] = useState('')
  const [crmFunnelId, setCrmFunnelId] = useState<string | undefined>(draft.crmFunnelId ?? undefined)

  useEffect(() => {
    if (!open) return
    setDraft(filters)
    setCrmFunnelId(filters.crmFunnelId ?? undefined)
    setTeamSearch('')
  }, [open, filters])

  const { data: funnels = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.funnels,
    queryFn: fetchWhatsAppFunnels,
    enabled: open,
  })

  useEffect(() => {
    if (!open || crmFunnelId || funnels.length === 0) return
    setCrmFunnelId(pickDefaultFunnelId(funnels))
  }, [open, funnels, crmFunnelId])

  const { data: stages = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.stages(crmFunnelId),
    queryFn: () => fetchWhatsAppStages(crmFunnelId),
    enabled: open && !!crmFunnelId,
  })

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-profiles-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name')

      if (error) throw error
      return data ?? []
    },
    enabled: open && activeCategory === 'team',
  })

  const filteredTeamMembers = useMemo(() => {
    const term = teamSearch.trim().toLowerCase()
    if (!term) return teamMembers
    return teamMembers.filter((member) => {
      const name = member.full_name?.toLowerCase() ?? ''
      const email = member.email?.toLowerCase() ?? ''
      return name.includes(term) || email.includes(term)
    })
  }, [teamMembers, teamSearch])

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  const renderSubmenu = () => {
    if (activeCategory === 'team') {
      return (
        <div className="flex h-full flex-col">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-roll-gray-400" />
            <input
              type="text"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              placeholder="Buscar membros..."
              className="w-full rounded-lg border border-roll-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-roll-gray-50">
                <input
                  type="radio"
                  name="team-filter"
                  checked={draft.teamMemberId === 'unassigned'}
                  onChange={() => setDraft((prev) => ({ ...prev, teamMemberId: 'unassigned' }))}
                  className="mt-1 accent-roll-orange"
                />
                <span className="text-sm text-roll-gray-800">Sem atribuição</span>
              </label>
            </li>
            {filteredTeamMembers.map((member) => (
              <li key={member.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-roll-gray-50">
                  <input
                    type="radio"
                    name="team-filter"
                    checked={draft.teamMemberId === member.id}
                    onChange={() => setDraft((prev) => ({ ...prev, teamMemberId: member.id }))}
                    className="mt-1 accent-roll-orange"
                  />
                  <span>
                    <span className="block text-sm text-roll-gray-800">{member.full_name ?? 'Sem nome'}</span>
                    {member.email && (
                      <span className="block text-xs text-roll-gray-400">{member.email}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-roll-gray-400">
            Atribuição por membro em breve. Por enquanto, só &quot;Sem atribuição&quot; filtra a lista.
          </p>
        </div>
      )
    }

    if (activeCategory === 'crm') {
      return (
        <div className="space-y-3">
          {funnels.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {funnels.map((funnel) => (
                <button
                  key={funnel.id}
                  type="button"
                  onClick={() => {
                    setCrmFunnelId(funnel.id)
                    setDraft((prev) => ({ ...prev, crmFunnelId: funnel.id, crmStageId: null }))
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    crmFunnelId === funnel.id
                      ? 'bg-roll-orange text-white'
                      : 'bg-roll-gray-100 text-roll-gray-600 hover:bg-roll-gray-200'
                  }`}
                >
                  {funnel.name}
                </button>
              ))}
            </div>
          )}
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, crmFunnelId: crmFunnelId ?? null, crmStageId: null }))}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                  !draft.crmStageId ? 'bg-orange-50 font-medium text-roll-orange' : 'hover:bg-roll-gray-50'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-roll-gray-300" />
                Todas as etapas
              </button>
            </li>
            {stages.map((stage) => (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({
                    ...prev,
                    crmFunnelId: crmFunnelId ?? null,
                    crmStageId: stage.id,
                  }))}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                    draft.crmStageId === stage.id
                      ? 'bg-orange-50 font-medium text-roll-orange'
                      : 'hover:bg-roll-gray-50 text-roll-gray-800'
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )
    }

    if (activeCategory === 'tags') {
      return (
        <ul className="flex flex-wrap gap-2">
          {ALL_WHATSAPP_TAG_KEYS.map((tag) => {
            const active = draft.tagKeys.includes(tag)
            return (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({
                    ...prev,
                    tagKeys: active
                      ? prev.tagKeys.filter((item) => item !== tag)
                      : [...prev.tagKeys, tag],
                  }))}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                    active ? WHATSAPP_TAG_STYLES[tag] : 'bg-white text-roll-gray-500 ring-roll-gray-200'
                  }`}
                >
                  {WHATSAPP_TAG_LABELS[tag]}
                </button>
              </li>
            )
          })}
        </ul>
      )
    }

    if (activeCategory === 'automation') {
      return (
        <ul className="space-y-1">
          {[
            { value: null, label: 'Todas' },
            { value: true, label: 'Atendente virtual ligado' },
            { value: false, label: 'Atendente virtual desligado' },
          ].map((option) => (
            <li key={String(option.value)}>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, automation: option.value }))}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${
                  draft.automation === option.value
                    ? 'bg-orange-50 font-medium text-roll-orange'
                    : 'text-roll-gray-800 hover:bg-roll-gray-50'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )
    }

    if (activeCategory === 'read') {
      return (
        <ul className="space-y-1">
          {[
            { value: null, label: 'Todas' },
            { value: 'unread' as const, label: 'Não lidas' },
            { value: 'read' as const, label: 'Lidas' },
          ].map((option) => (
            <li key={String(option.value)}>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, readStatus: option.value }))}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${
                  draft.readStatus === option.value
                    ? 'bg-orange-50 font-medium text-roll-orange'
                    : 'text-roll-gray-800 hover:bg-roll-gray-50'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )
    }

    if (activeCategory === 'last_response') {
      return (
        <ul className="space-y-1">
          {[
            { value: null, label: 'Todas' },
            { value: 'inbound' as const, label: 'Cliente' },
            { value: 'outbound' as const, label: 'Equipe' },
          ].map((option) => (
            <li key={String(option.value)}>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, lastResponseBy: option.value }))}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${
                  draft.lastResponseBy === option.value
                    ? 'bg-orange-50 font-medium text-roll-orange'
                    : 'text-roll-gray-800 hover:bg-roll-gray-50'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )
    }

    return (
      <p className="py-8 text-center text-sm text-roll-gray-400">
        Este filtro estará disponível em breve.
      </p>
    )
  }

  const activeCategoryMeta = FILTER_CATEGORIES.find((item) => item.id === activeCategory)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 sm:items-center sm:pt-4">
      <div
        ref={panelRef}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Filtros de conversas"
      >
        <div className="flex items-center justify-between border-b border-roll-gray-100 px-4 py-3">
          <h2 className="text-base font-semibold text-roll-gray-900">
            Filtros ({countActiveFilters(draft)})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-roll-gray-400 hover:bg-roll-gray-100 hover:text-roll-gray-600"
            aria-label="Fechar filtros"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-[320px] grid-cols-1 sm:grid-cols-[220px_1fr]">
          <div className="border-b border-roll-gray-100 sm:border-b-0 sm:border-r">
            <ul className="max-h-72 overflow-y-auto py-2 sm:max-h-none">
              {FILTER_CATEGORIES.map((category) => {
                const Icon = category.icon
                const active = activeCategory === category.id
                const hasValue = isCategoryActive(category.id, draft)

                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      disabled={category.disabled}
                      onClick={() => setActiveCategory(category.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active ? 'bg-orange-50 text-roll-orange' : 'text-roll-gray-700 hover:bg-roll-gray-50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${category.iconClass}`} />
                      <span className="min-w-0 flex-1 truncate">{category.label}</span>
                      {category.soon && (
                        <span className="text-[10px] uppercase text-roll-gray-400">breve</span>
                      )}
                      {hasValue && !category.soon && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-roll-orange" />
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-roll-gray-300" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="p-4">
            <p className="mb-3 text-sm font-semibold text-roll-gray-800">
              {activeCategoryMeta?.label}
            </p>
            {renderSubmenu()}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-roll-gray-100 px-4 py-3">
          <Button
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_CONVERSATION_FILTERS)
              onApply(EMPTY_CONVERSATION_FILTERS)
            }}
          >
            Limpar
          </Button>
          <Button onClick={() => onApply(draft)}>Aplicar</Button>
        </div>
      </div>
    </div>
  )
}
