import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/utils'
import type { Client, WhatsAppStage } from '@/types/database'

export const WHATSAPP_CRM_QUERY_KEYS = {
  stages: ['whatsapp-stages'] as const,
  clients: ['whatsapp-crm-clients'] as const,
  clientByPhone: (phone: string) => ['whatsapp-crm-client', phone] as const,
}

export const STAGE_COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#6b7280', label: 'Cinza' },
  { value: '#ef4444', label: 'Vermelho' },
] as const

export type WhatsAppCrmClient = Client & {
  whatsapp_stages: WhatsAppStage | null
}

export async function fetchWhatsAppStages(): Promise<WhatsAppStage[]> {
  const { data, error } = await supabase
    .from('whatsapp_stages')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw error
  return (data ?? []) as WhatsAppStage[]
}

export async function fetchWhatsAppCrmClients(): Promise<WhatsAppCrmClient[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*, whatsapp_stages(*)')
    .not('whatsapp_stage_id', 'is', null)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as WhatsAppCrmClient[]
}

export async function findClientByPhone(phone: string): Promise<Client | null> {
  const normalized = normalizePhone(phone)
  const { data, error } = await supabase.from('clients').select('*').eq('phone', normalized).maybeSingle()
  if (error) throw error
  if (data) return data as Client

  const { data: allClients, error: listError } = await supabase
    .from('clients')
    .select('*')
    .not('phone', 'is', null)

  if (listError) throw listError

  const match = (allClients ?? []).find(
    (client) => client.phone && normalizePhone(client.phone) === normalized,
  )

  return (match as Client | undefined) ?? null
}

export async function createWhatsAppStage(name: string, color: string): Promise<WhatsAppStage> {
  const { count, error: countError } = await supabase
    .from('whatsapp_stages')
    .select('*', { count: 'exact', head: true })

  if (countError) throw countError

  const position = count ?? 0

  const { data, error } = await supabase
    .from('whatsapp_stages')
    .insert({ name: name.trim(), color, position })
    .select('*')
    .single()

  if (error) throw error
  return data as WhatsAppStage
}

export function formatCrmError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Erro desconhecido ao acessar o CRM.'
  const e = error as { code?: string; message?: string; details?: string }

  if (e.code === '42P01' || e.message?.includes('whatsapp_stages')) {
    return 'Tabela do CRM não existe. Execute a migration 004_whatsapp_crm_stages.sql no Supabase (npm run db:whatsapp-crm).'
  }
  if (e.code === '42703' || e.message?.includes('whatsapp_stage_id')) {
    return 'Coluna whatsapp_stage_id não existe em clients. Execute npm run db:whatsapp-crm.'
  }
  if (e.code === '42501' || e.message?.toLowerCase().includes('policy')) {
    return 'Sem permissão no banco. Seu usuário precisa ser admin ou operador.'
  }

  return e.message ?? e.details ?? 'Erro ao acessar o CRM.'
}

export async function deleteWhatsAppStage(stageId: string): Promise<void> {
  const { error } = await supabase.from('whatsapp_stages').delete().eq('id', stageId)
  if (error) throw error
}

export async function moveClientToStage(clientId: string, stageId: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ whatsapp_stage_id: stageId })
    .eq('id', clientId)

  if (error) throw error
}

export async function removeClientFromWhatsAppCrm(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ whatsapp_stage_id: null })
    .eq('id', clientId)

  if (error) throw error
}

export async function saveClientToWhatsAppCrm(input: {
  name: string
  phone: string
  email?: string | null
  stageId: string
  notes?: string | null
}): Promise<Client> {
  const phone = normalizePhone(input.phone)
  const existing = await findClientByPhone(input.phone)

  const payload = {
    name: input.name.trim(),
    phone,
    email: input.email?.trim() || null,
    whatsapp_stage_id: input.stageId,
    source: 'whatsapp',
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  }

  if (existing) {
    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return data as Client
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...payload, status: 'lead', whatsapp_opt_in: true, email_opt_in: true })
    .select('*')
    .single()

  if (error) throw error
  return data as Client
}
