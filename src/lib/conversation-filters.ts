import type { WhatsAppTagKey } from '@/lib/whatsapp-tags'
import type { WhatsAppConversation } from '@/types/database'
import { normalizePhone } from '@/lib/utils'

export interface ConversationFilters {
  crmFunnelId: string | null
  crmStageId: string | null
  automation: boolean | null
  readStatus: 'unread' | 'read' | null
  lastResponseBy: 'inbound' | 'outbound' | null
  teamMemberId: string | null
  tagKeys: WhatsAppTagKey[]
}

export const EMPTY_CONVERSATION_FILTERS: ConversationFilters = {
  crmFunnelId: null,
  crmStageId: null,
  automation: null,
  readStatus: null,
  lastResponseBy: null,
  teamMemberId: null,
  tagKeys: [],
}

export function countActiveFilters(filters: ConversationFilters): number {
  let count = 0
  if (filters.crmFunnelId || filters.crmStageId) count += 1
  if (filters.automation !== null) count += 1
  if (filters.readStatus) count += 1
  if (filters.lastResponseBy) count += 1
  if (filters.teamMemberId) count += 1
  if (filters.tagKeys.length > 0) count += 1
  return count
}

export function filterConversations(
  conversations: WhatsAppConversation[],
  filters: ConversationFilters,
  context: {
    clientStageByPhone: Map<string, string>
    funnelStageIds: Set<string>
    lastDirectionByConversation: Map<string, 'inbound' | 'outbound'>
    clientTagsByPhone: Map<string, WhatsAppTagKey[]>
  },
): WhatsAppConversation[] {
  const hasCrmFilter = Boolean(filters.crmStageId || filters.crmFunnelId)
  const hasAnyFilter = countActiveFilters(filters) > 0

  if (!hasAnyFilter) return conversations

  return conversations.filter((conversation) => {
    if (hasCrmFilter) {
      const stageId = context.clientStageByPhone.get(normalizePhone(conversation.wa_phone))
      if (!stageId) return false
      if (filters.crmStageId) {
        if (stageId !== filters.crmStageId) return false
      } else if (filters.crmFunnelId && context.funnelStageIds.size > 0) {
        if (!context.funnelStageIds.has(stageId)) return false
      }
    }

    if (filters.automation !== null && conversation.ai_enabled !== filters.automation) {
      return false
    }

    if (filters.readStatus === 'unread' && conversation.unread_count <= 0) return false
    if (filters.readStatus === 'read' && conversation.unread_count > 0) return false

    if (filters.lastResponseBy) {
      const direction = context.lastDirectionByConversation.get(conversation.id)
      if (!direction || direction !== filters.lastResponseBy) return false
    }

    if (filters.teamMemberId && filters.teamMemberId !== 'unassigned') {
      return false
    }

    if (filters.tagKeys.length > 0) {
      const tags = context.clientTagsByPhone.get(normalizePhone(conversation.wa_phone)) ?? []
      if (!filters.tagKeys.some((tag) => tags.includes(tag))) return false
    }

    return true
  })
}
