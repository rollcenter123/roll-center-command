import type { WhatsAppFunnel, WhatsAppStage } from '@/types/database'

export interface CrmStagesMenuProps {
  funnels: WhatsAppFunnel[]
  selectedFunnelId: string | undefined
  onFunnelChange: (funnelId: string) => void
  stages: WhatsAppStage[]
  activeStageId?: string | null
  onStageSelect: (stageId: string | null) => void
  mode: 'assign' | 'filter'
  canEdit?: boolean
  pendingStageId?: string | null
  showAllOption?: boolean
}

export function CrmStagesMenu({
  funnels,
  selectedFunnelId,
  onFunnelChange,
  stages,
  activeStageId,
  onStageSelect,
  mode,
  canEdit = true,
  pendingStageId,
  showAllOption = false,
}: CrmStagesMenuProps) {
  const title = mode === 'filter' ? 'Filtrar por etapa' : 'Etapa do CRM'

  return (
    <div className="w-64 rounded-lg border border-roll-gray-200 bg-white p-2 shadow-lg">
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-roll-gray-400">
        {title}
      </p>

      {funnels.length > 1 && (
        <div className="mb-2 flex gap-1 overflow-x-auto px-1 pb-1">
          {funnels.map((funnel) => {
            const active = funnel.id === selectedFunnelId
            return (
              <button
                key={funnel.id}
                type="button"
                onClick={() => onFunnelChange(funnel.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-roll-orange text-white'
                    : 'bg-roll-gray-100 text-roll-gray-600 hover:bg-roll-gray-200'
                }`}
              >
                {funnel.name}
              </button>
            )
          })}
        </div>
      )}

      {funnels.length === 1 && (
        <p className="mb-2 px-2 text-xs font-medium text-roll-gray-600">{funnels[0].name}</p>
      )}

      {mode === 'assign' && !canEdit && (
        <p className="px-2 py-2 text-xs text-roll-gray-500">Sem permissão para editar o CRM.</p>
      )}

      {stages.length === 0 && (
        <p className="px-2 py-2 text-xs text-roll-gray-500">
          Nenhuma etapa neste funil. Adicione colunas no CRM do Dashboard.
        </p>
      )}

      {stages.length > 0 && (mode === 'filter' || canEdit) && (
        <ul className="max-h-64 space-y-1 overflow-y-auto py-1">
          {showAllOption && (
            <li>
              <button
                type="button"
                onClick={() => onStageSelect(null)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                  !activeStageId
                    ? 'bg-orange-50 font-medium text-roll-orange'
                    : 'text-roll-gray-800 hover:bg-roll-gray-50'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-roll-gray-300" />
                <span>Todas as etapas</span>
              </button>
            </li>
          )}

          {stages.map((stage) => {
            const isActive = activeStageId === stage.id
            const isSaving = pendingStageId === stage.id

            return (
              <li key={stage.id}>
                <button
                  type="button"
                  disabled={mode === 'assign' && Boolean(pendingStageId)}
                  onClick={() => onStageSelect(stage.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                    isActive
                      ? 'bg-orange-50 font-medium text-roll-orange'
                      : 'text-roll-gray-800 hover:bg-roll-gray-50'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{stage.name}</span>
                  {isSaving && <span className="text-xs text-roll-gray-400">...</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
