import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/utils'
import { findClientByPhone } from '@/lib/whatsapp-crm'

export type WhatsAppTagKey = 'cotacao' | 'em_conversa' | 'cotacao_feita' | 'nao_quer'

export const WHATSAPP_TAG_STYLES: Record<WhatsAppTagKey, string> = {
  cotacao: 'bg-blue-50 text-blue-700 ring-blue-200',
  em_conversa: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cotacao_feita: 'bg-violet-50 text-violet-700 ring-violet-200',
  nao_quer: 'bg-roll-gray-100 text-roll-gray-600 ring-roll-gray-200',
}

export const WHATSAPP_TAG_LABELS: Record<WhatsAppTagKey, string> = {
  cotacao: 'cotação',
  em_conversa: 'em conversa',
  cotacao_feita: 'cotação feita',
  nao_quer: 'não quer',
}

export const ALL_WHATSAPP_TAG_KEYS = Object.keys(WHATSAPP_TAG_LABELS) as WhatsAppTagKey[]

const TAG_KEY_SET = new Set<string>(ALL_WHATSAPP_TAG_KEYS)

export function isWhatsAppTagKey(value: string): value is WhatsAppTagKey {
  return TAG_KEY_SET.has(value)
}

export function parseClientTags(tags: string[] | null | undefined): WhatsAppTagKey[] {
  if (!tags?.length) return []
  return tags.filter(isWhatsAppTagKey)
}

export async function saveClientWhatsAppTags(input: {
  phone: string
  name: string
  email?: string | null
  clientId?: string | null
  tags: WhatsAppTagKey[]
}): Promise<string> {
  const phone = normalizePhone(input.phone)
  const existing = input.clientId
    ? { id: input.clientId }
    : await findClientByPhone(input.phone)

  const payload = {
    tags: input.tags,
    name: input.name.trim(),
    phone,
    ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
  }

  if (existing && 'id' in existing && existing.id) {
    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) throw error
    if (!data?.id) throw new Error('Cliente não encontrado')
    return data.id
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...payload,
      status: 'lead',
      whatsapp_opt_in: true,
      email_opt_in: true,
      source: 'whatsapp',
    })
    .select('id')
    .single()

  if (error) throw error
  if (!data?.id) throw new Error('Não foi possível salvar as TAGs')
  return data.id
}
