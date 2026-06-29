import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, Trash2, User, UserCog } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createWhatsAppFunnel,
  createWhatsAppStage,
  deleteWhatsAppFunnel,
  deleteWhatsAppStage,
  fetchWhatsAppCrmClients,
  fetchWhatsAppFunnels,
  fetchWhatsAppStages,
  formatCrmError,
  moveClientToStage,
  PROTECTED_FUNNEL_NAMES,
  STAGE_COLOR_OPTIONS,
  WHATSAPP_CRM_QUERY_KEYS,
  type WhatsAppCrmClient,
} from '@/lib/whatsapp-crm'
import { formatPhone } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { WhatsAppFunnel, WhatsAppStage } from '@/types/database'

/** Quantos cards ficam visíveis antes de rolar dentro da coluna */
const KANBAN_VISIBLE_CARDS = 8
/** Altura estimada de cada card + gap (px) para calcular o scroll da coluna */
const KANBAN_CARD_SLOT_PX = 96
const KANBAN_COLUMN_SCROLL_MAX_PX =
  KANBAN_VISIBLE_CARDS * KANBAN_CARD_SLOT_PX + 24

function KanbanCard({
  client,
  onDragStart,
}: {
  client: WhatsAppCrmClient
  onDragStart: (clientId: string) => void
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(client.id)}
      className="cursor-grab rounded-lg border border-roll-gray-200 bg-white p-3 shadow-sm transition-shadow active:cursor-grabbing hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-roll-gray-300" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-roll-gray-900">{client.name}</p>
          {client.phone && (
            <p className="mt-0.5 truncate text-xs text-roll-gray-500">{formatPhone(client.phone)}</p>
          )}
          {client.company && (
            <p className="mt-1 truncate text-xs text-roll-gray-400">{client.company}</p>
          )}
          <Link
            to={`/clientes/${client.id}`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-roll-orange hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <User className="h-3 w-3" />
            Ver cliente
          </Link>
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  stage,
  clients,
  canEdit,
  draggingClientId,
  onDragStart,
  onDrop,
  onDelete,
}: {
  stage: WhatsAppStage
  clients: WhatsAppCrmClient[]
  canEdit: boolean
  draggingClientId: string | null
  onDragStart: (clientId: string) => void
  onDrop: (stageId: string) => void
  onDelete: (stage: WhatsAppStage) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-roll-gray-50 transition-colors ${
        dragOver ? 'border-roll-orange bg-orange-50/50' : 'border-roll-gray-200'
      }`}
      onDragOver={(e) => {
        if (!canEdit || !draggingClientId) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (canEdit && draggingClientId) onDrop(stage.id)
      }}
    >
      <div className="flex items-center gap-2 border-b border-roll-gray-200 px-3 py-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-roll-gray-900">
          {stage.name}
        </h3>
        <span className="rounded-full bg-roll-gray-200 px-2 py-0.5 text-xs font-medium text-roll-gray-600">
          {clients.length}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => onDelete(stage)}
            className="rounded p-1 text-roll-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Excluir coluna"
            aria-label={`Excluir coluna ${stage.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex flex-col gap-2 overflow-y-auto overscroll-y-contain p-3"
          style={{ maxHeight: KANBAN_COLUMN_SCROLL_MAX_PX }}
        >
          {clients.map((client) => (
            <KanbanCard key={client.id} client={client} onDragStart={onDragStart} />
          ))}
          {clients.length === 0 && (
            <p className="py-6 text-center text-xs text-roll-gray-400">
              {canEdit ? 'Arraste clientes para cá' : 'Nenhum cliente'}
            </p>
          )}
        </div>
        {clients.length > KANBAN_VISIBLE_CARDS && (
          <p className="border-t border-roll-gray-200 px-3 py-2 text-center text-[11px] text-roll-gray-400">
            +{clients.length - KANBAN_VISIBLE_CARDS} abaixo · role a coluna
          </p>
        )}
      </div>
    </div>
  )
}

export function WhatsAppCrmKanban() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('clients_edit')

  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null)
  const [draggingClientId, setDraggingClientId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createFunnelOpen, setCreateFunnelOpen] = useState(false)
  const [deleteFunnelTarget, setDeleteFunnelTarget] = useState<WhatsAppFunnel | null>(null)
  const [newFunnelName, setNewFunnelName] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState<string>(STAGE_COLOR_OPTIONS[2].value)
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppStage | null>(null)

  const canManageTeam = hasPermission('team_manage')

  const {
    data: funnels = [],
    isLoading: funnelsLoading,
    isError: funnelsError,
    error: funnelsErrorDetail,
    refetch: refetchFunnels,
  } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.funnels,
    queryFn: fetchWhatsAppFunnels,
  })

  const activeFunnelId = selectedFunnelId ?? funnels.find((f) => f.name === 'Disparo Base')?.id ?? funnels[0]?.id ?? null
  const activeFunnel = funnels.find((f) => f.id === activeFunnelId) ?? null

  const {
    data: stages = [],
    isLoading: stagesLoading,
    isError: stagesError,
    error: stagesErrorDetail,
    refetch: refetchStages,
  } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.stages(activeFunnelId ?? undefined),
    queryFn: () => fetchWhatsAppStages(activeFunnelId ?? undefined),
    enabled: !!activeFunnelId,
  })

  const {
    data: clients = [],
    isLoading: clientsLoading,
    isError: clientsError,
    error: clientsErrorDetail,
  } = useQuery({
    queryKey: WHATSAPP_CRM_QUERY_KEYS.clients(activeFunnelId ?? undefined),
    queryFn: () => fetchWhatsAppCrmClients(activeFunnelId ?? undefined),
    enabled: !!activeFunnelId,
    retry: 1,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: WHATSAPP_CRM_QUERY_KEYS.funnels })
    void queryClient.invalidateQueries({ queryKey: ['whatsapp-stages'] })
    void queryClient.invalidateQueries({ queryKey: ['whatsapp-crm-clients'] })
    void queryClient.invalidateQueries({ queryKey: ['clients'] })
  }

  const moveMutation = useMutation({
    mutationFn: ({ clientId, stageId }: { clientId: string; stageId: string }) =>
      moveClientToStage(clientId, stageId),
    onSuccess: invalidate,
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!activeFunnelId) throw new Error('Selecione um funil')
      return createWhatsAppStage(activeFunnelId, newStageName, newStageColor)
    },
    onSuccess: () => {
      invalidate()
      setCreateOpen(false)
      setNewStageName('')
      setNewStageColor(STAGE_COLOR_OPTIONS[2].value)
    },
  })

  const createFunnelMutation = useMutation({
    mutationFn: () => createWhatsAppFunnel(newFunnelName),
    onSuccess: (funnel) => {
      invalidate()
      setCreateFunnelOpen(false)
      setNewFunnelName('')
      setSelectedFunnelId(funnel.id)
    },
  })

  const deleteFunnelMutation = useMutation({
    mutationFn: (funnelId: string) => deleteWhatsAppFunnel(funnelId),
    onSuccess: () => {
      invalidate()
      setDeleteFunnelTarget(null)
      setSelectedFunnelId(null)
    },
  })

  const openCreateModal = () => {
    createMutation.reset()
    setCreateOpen(true)
  }

  const deleteMutation = useMutation({
    mutationFn: (stageId: string) => deleteWhatsAppStage(stageId),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  const clientsByStage = stages.reduce<Record<string, WhatsAppCrmClient[]>>((acc, stage) => {
    acc[stage.id] = clients.filter((c) => c.whatsapp_stage_id === stage.id)
    return acc
  }, {})

  const handleDrop = (stageId: string) => {
    if (!draggingClientId) return
    moveMutation.mutate({ clientId: draggingClientId, stageId })
    setDraggingClientId(null)
  }

  if (funnelsLoading || stagesLoading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-roll-gray-200 bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
      </div>
    )
  }

  if (funnelsError || stagesError) {
    const errorDetail = funnelsError ? funnelsErrorDetail : stagesErrorDetail
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-800">Não foi possível carregar o CRM de atendimento.</p>
        <p className="mt-1 text-sm text-red-700">{formatCrmError(errorDetail)}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            void refetchFunnels()
            void refetchStages()
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  const visibleFunnels = funnels.filter((f) => f.name !== 'Atendimento Geral')
  const canDeleteFunnel =
    canEdit &&
    activeFunnel &&
    !PROTECTED_FUNNEL_NAMES.includes(activeFunnel.name as (typeof PROTECTED_FUNNEL_NAMES)[number])

  return (
    <div id="crm" className="space-y-4 scroll-mt-8">
      {clientsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {formatCrmError(clientsErrorDetail)}
        </div>
      )}

      {clientsLoading && stages.length > 0 && (
        <p className="text-xs text-roll-gray-400">Carregando clientes do CRM...</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-roll-gray-900">CRM</h2>
          <p className="text-sm text-roll-gray-500">
            Organize os clientes por funil e etapa do atendimento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {visibleFunnels.length > 0 && (
            <select
              value={activeFunnelId ?? ''}
              onChange={(e) => setSelectedFunnelId(e.target.value)}
              className="rounded-lg border border-roll-gray-300 bg-white px-3 py-2 text-sm text-roll-gray-800"
              aria-label="Selecionar funil"
            >
              {visibleFunnels.map((funnel: WhatsAppFunnel) => (
                <option key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </option>
              ))}
            </select>
          )}
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  createFunnelMutation.reset()
                  setCreateFunnelOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Novo funil
              </Button>
              {canDeleteFunnel && activeFunnel && (
                <Button variant="outline" onClick={() => setDeleteFunnelTarget(activeFunnel)}>
                  <Trash2 className="h-4 w-4" />
                  Excluir funil
                </Button>
              )}
              {activeFunnelId && (
                <Button variant="outline" onClick={openCreateModal}>
                  <Plus className="h-4 w-4" />
                  Nova coluna
                </Button>
              )}
            </>
          )}
          {canManageTeam && (
            <Link to="/equipe">
              <Button variant="outline">
                <UserCog className="h-4 w-4" />
                Editar equipe
              </Button>
            </Link>
          )}
        </div>
      </div>

      {activeFunnel && (
        <p className="text-xs text-roll-gray-400">
          Funil: <span className="font-medium text-roll-gray-600">{activeFunnel.name}</span>
          {' · '}
          {clients.length} leads no quadro
        </p>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4" style={{ minHeight: KANBAN_COLUMN_SCROLL_MAX_PX + 56 }}>
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              clients={clientsByStage[stage.id] ?? []}
              canEdit={canEdit}
              draggingClientId={draggingClientId}
              onDragStart={setDraggingClientId}
              onDrop={handleDrop}
              onDelete={setDeleteTarget}
            />
          ))}

          {canEdit && stages.length === 0 && (
            <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-roll-gray-300 bg-white p-8">
              <p className="text-sm text-roll-gray-500">
                Crie a primeira coluna para organizar os atendimentos.
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal open={createFunnelOpen} onClose={() => setCreateFunnelOpen(false)} title="Novo funil">
        <div className="space-y-4">
          <p className="text-sm text-roll-gray-600">
            O funil será criado com as etapas padrão: Disparado, Respondeu, Cotou, Não Quer e Não Existe/Mudou.
          </p>
          <div>
            <label htmlFor="funnel-name" className="mb-1 block text-sm font-medium text-roll-gray-700">
              Nome do funil
            </label>
            <Input
              id="funnel-name"
              value={newFunnelName}
              onChange={(e) => setNewFunnelName(e.target.value)}
              placeholder="Ex: Disparos Equipe A"
              autoFocus
            />
          </div>
          {createFunnelMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formatCrmError(createFunnelMutation.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateFunnelOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createFunnelMutation.mutate()}
              loading={createFunnelMutation.isPending}
              disabled={!newFunnelName.trim()}
            >
              Criar funil
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteFunnelTarget}
        onClose={() => setDeleteFunnelTarget(null)}
        title="Excluir funil"
      >
        <p className="text-sm text-roll-gray-600">
          Excluir o funil <strong>{deleteFunnelTarget?.name}</strong>? Todas as colunas serão removidas e os
          clientes sairão deste quadro (permanecem cadastrados em Clientes).
        </p>
        {deleteFunnelMutation.isError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formatCrmError(deleteFunnelMutation.error)}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteFunnelTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteFunnelMutation.isPending}
            onClick={() => deleteFunnelTarget && deleteFunnelMutation.mutate(deleteFunnelTarget.id)}
          >
            Excluir funil
          </Button>
        </div>
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova coluna">
        <div className="space-y-4">
          <div>
            <label htmlFor="stage-name" className="mb-1 block text-sm font-medium text-roll-gray-700">
              Nome da etapa
            </label>
            <Input
              id="stage-name"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="Ex: Aguardando retorno"
              autoFocus
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-roll-gray-700">Cor</p>
            <div className="flex flex-wrap gap-2">
              {STAGE_COLOR_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => setNewStageColor(value)}
                  className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition-transform hover:scale-110 ${
                    newStageColor === value ? 'ring-roll-orange' : 'ring-transparent'
                  }`}
                  style={{ backgroundColor: value }}
                />
              ))}
            </div>
          </div>
          {createMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formatCrmError(createMutation.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!newStageName.trim()}
            >
              Criar coluna
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir coluna"
      >
        <p className="text-sm text-roll-gray-600">
          Excluir a coluna <strong>{deleteTarget?.name}</strong>? Os clientes nela sairão do quadro de
          atendimento (permanecem cadastrados em Clientes).
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  )
}
