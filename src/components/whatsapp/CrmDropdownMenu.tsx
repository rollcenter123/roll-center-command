import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchWhatsAppFunnels,
  fetchWhatsAppStages,
  findClientByPhone,
  formatCrmError,
  saveClientToWhatsAppCrm,
  WHATSAPP_CRM_QUERY_KEYS,
} from '@/lib/whatsapp-crm'
import { useAuth } from '@/contexts/AuthContext'
import { CrmToolbarIcon } from '@/components/whatsapp/ChatToolbarIcons'

export interface CrmContact {
  name: string
  phone: string
  email: string
  notes?: string
}

export function CrmStageShortcut({ contact }: { contact: CrmContact }) {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('clients_edit')
  const menuRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: funnels = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.funnels,
    queryFn: fetchWhatsAppFunnels,
    enabled: open,
  })

  const defaultFunnelId =
    funnels.find((f) => f.name === 'Disparo Base')?.id ?? funnels.find((f) => f.name !== 'Atendimento Geral')?.id

  const { data: stages = [] } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.stages(defaultFunnelId),
    queryFn: () => fetchWhatsAppStages(defaultFunnelId),
    enabled: open && !!defaultFunnelId,
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

      const stageName = stages.find((s) => s.id === client.whatsapp_stage_id)?.name ?? 'CRM'
      setFeedback(`Salvo em "${stageName}"`)
      setError(null)
      window.setTimeout(() => {
        setOpen(false)
        setFeedback(null)
      }, 900)
    },
    onError: (err) => {
      setError(formatCrmError(err))
      setFeedback(null)
    },
  })

  const currentStageId = existingClient?.whatsapp_stage_id
  const inCrm = Boolean(currentStageId)

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          setFeedback(null)
          setError(null)
        }}
        className="flex h-8 w-8 items-center justify-center border-0 bg-transparent p-0 outline-none transition-transform active:scale-90"
        title="Colocar na etapa do CRM"
        aria-label="Colocar na etapa do CRM"
        aria-expanded={open}
      >
        <CrmToolbarIcon active={inCrm || open} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-roll-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-roll-gray-400">
            Etapa do CRM
          </p>

          {!canEdit && (
            <p className="px-2 py-2 text-xs text-roll-gray-500">Sem permissão para editar o CRM.</p>
          )}

          {canEdit && stages.length === 0 && (
            <p className="px-2 py-2 text-xs text-roll-gray-500">
              Nenhuma coluna criada. Adicione etapas no CRM do Dashboard.
            </p>
          )}

          {canEdit && stages.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto py-1">
              {stages.map((stage) => {
                const isCurrent = currentStageId === stage.id
                const isSaving = saveMutation.isPending && saveMutation.variables === stage.id

                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate(stage.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                        isCurrent
                          ? 'bg-orange-50 font-medium text-roll-orange'
                          : 'text-roll-gray-800 hover:bg-roll-gray-50'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="min-w-0 flex-1 truncate">{stage.name}</span>
                      {isSaving && (
                        <span className="text-xs text-roll-gray-400">...</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {feedback && (
            <p className="mx-1 mt-1 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
              {feedback}
            </p>
          )}

          {error && (
            <p className="mx-1 mt-1 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** @deprecated Use CrmStageShortcut */
export const CrmDropdownMenu = CrmStageShortcut
