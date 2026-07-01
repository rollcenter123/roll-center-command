import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchWhatsAppFunnels,
  fetchWhatsAppStages,
  findClientByPhone,
  saveClientToWhatsAppCrm,
  WHATSAPP_CRM_QUERY_KEYS,
} from '@/lib/whatsapp-crm'
import { mapChatCrmError } from '@/lib/whatsapp-chat-messages'
import { useAuth } from '@/contexts/AuthContext'
import { CrmToolbarIcon } from '@/components/whatsapp/ChatToolbarIcons'
import { CrmStagesMenu } from '@/components/whatsapp/CrmStagesMenu'

export interface CrmContact {
  name: string
  phone: string
  email: string
  notes?: string
}

function pickDefaultFunnelId(funnels: { id: string; name: string }[]): string | undefined {
  return (
    funnels.find((f) => f.name === 'Disparo Base')?.id
    ?? funnels.find((f) => f.name !== 'Atendimento Geral')?.id
    ?? funnels[0]?.id
  )
}

export function CrmStageShortcut({ contact }: { contact: CrmContact }) {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('clients_edit')
  const menuRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | undefined>()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: funnels = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.funnels,
    queryFn: fetchWhatsAppFunnels,
    enabled: open,
  })

  useEffect(() => {
    if (!open || selectedFunnelId || funnels.length === 0) return
    setSelectedFunnelId(pickDefaultFunnelId(funnels))
  }, [open, funnels, selectedFunnelId])

  const { data: stages = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.stages(selectedFunnelId),
    queryFn: () => fetchWhatsAppStages(selectedFunnelId),
    enabled: open && !!selectedFunnelId,
  })

  const { data: existingClient } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.clientByPhone(contact.phone),
    queryFn: () => findClientByPhone(contact.phone),
    enabled: !!contact.phone,
  })

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const saveMutation = useMutation({
    mutationFn: (stageId: string) =>
      saveClientToWhatsAppCrm({
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        stageId,
        notes: contact.notes,
      }),
    onSuccess: (client) => {
      void queryClient.invalidateQueries({ queryKey: WHATSAPP_CRM_QUERY_KEYS.funnels })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-stages'] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-crm-clients'] })
      void queryClient.invalidateQueries({ queryKey: WHATSAPP_CRM_QUERY_KEYS.clientByPhone(contact.phone) })
      void queryClient.invalidateQueries({ queryKey: ['clients'] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-client-stage-map'] })

      const stageName = stages.find((s) => s.id === client.whatsapp_stage_id)?.name ?? 'CRM'
      setFeedback(`Salvo em "${stageName}"`)
      setError(null)
      window.setTimeout(() => {
        setOpen(false)
        setFeedback(null)
      }, 900)
    },
    onError: (err) => {
      setError(mapChatCrmError(err))
      setFeedback(null)
    },
  })

  const currentStageId = existingClient?.whatsapp_stage_id

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          setFeedback(null)
          setError(null)
        }}
        className="flex h-7 w-7 items-center justify-center border-0 bg-transparent p-0 outline-none transition-transform active:scale-90"
        title="CRM — etapas e filtros"
        aria-label="CRM — etapas e filtros"
        aria-expanded={open}
      >
        <CrmToolbarIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1">
          <CrmStagesMenu
            funnels={funnels}
            selectedFunnelId={selectedFunnelId}
            onFunnelChange={setSelectedFunnelId}
            stages={stages}
            activeStageId={currentStageId}
            onStageSelect={(stageId) => {
              if (stageId) saveMutation.mutate(stageId)
            }}
            mode="assign"
            canEdit={canEdit}
            pendingStageId={saveMutation.isPending ? saveMutation.variables ?? null : null}
          />

          {feedback && (
            <p className="mx-1 mt-1 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
              {feedback}
            </p>
          )}

          {error && (
            <p className="mx-1 mt-1 rounded-md bg-[#f5f6f6] px-2 py-1.5 text-xs text-[#667781]">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

export interface CrmListFilterProps {
  stageFilterId: string | null
  funnelFilterId: string | null
  onFilterChange: (funnelId: string | null, stageId: string | null) => void
}

export function CrmListFilter({
  stageFilterId,
  funnelFilterId,
  onFilterChange,
}: CrmListFilterProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | undefined>(funnelFilterId ?? undefined)

  const { data: funnels = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.funnels,
    queryFn: fetchWhatsAppFunnels,
    enabled: open,
  })

  useEffect(() => {
    if (!open || selectedFunnelId || funnels.length === 0) return
    setSelectedFunnelId(pickDefaultFunnelId(funnels))
  }, [open, funnels, selectedFunnelId])

  useEffect(() => {
    if (funnelFilterId) setSelectedFunnelId(funnelFilterId)
  }, [funnelFilterId])

  const { data: stages = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.stages(selectedFunnelId),
    queryFn: () => fetchWhatsAppStages(selectedFunnelId),
    enabled: open && !!selectedFunnelId,
  })

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const isActive = Boolean(stageFilterId || funnelFilterId)

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          isActive
            ? 'border-roll-orange bg-orange-50 text-roll-orange'
            : 'border-roll-gray-200 bg-white text-roll-gray-500 hover:bg-roll-gray-50'
        }`}
        title="Filtrar conversas por CRM"
        aria-label="Filtrar conversas por CRM"
        aria-expanded={open}
      >
        <CrmToolbarIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1">
          <CrmStagesMenu
            funnels={funnels}
            selectedFunnelId={selectedFunnelId}
            onFunnelChange={(funnelId) => {
              setSelectedFunnelId(funnelId)
              onFilterChange(funnelId, null)
            }}
            stages={stages}
            activeStageId={stageFilterId}
            onStageSelect={(stageId) => {
              if (!stageId) {
                onFilterChange(null, null)
                setOpen(false)
                return
              }
              onFilterChange(selectedFunnelId ?? null, stageId)
              setOpen(false)
            }}
            mode="filter"
            showAllOption
          />
        </div>
      )}
    </div>
  )
}

/** @deprecated Use CrmStageShortcut */
export const CrmDropdownMenu = CrmStageShortcut
