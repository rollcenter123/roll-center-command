import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/utils'
import type { Client, WhatsAppFunnel, WhatsAppStage } from '@/types/database'

export const WHATSAPP_CRM_QUERY_KEYS = {
  funnels: ['whatsapp-funnels'] as const,
  stages: (funnelId?: string) => (funnelId ? ['whatsapp-stages', funnelId] as const : ['whatsapp-stages'] as const),
  clients: (funnelId?: string) => (funnelId ? ['whatsapp-crm-clients', funnelId] as const : ['whatsapp-crm-clients'] as const),
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

export const DEFAULT_FUNNEL_STAGES = [
  { name: 'Disparado', position: 0, color: '#3b82f6' },
  { name: 'Respondeu', position: 1, color: '#f97316' },
  { name: 'Cotou', position: 2, color: '#22c55e' },
  { name: 'Não Quer', position: 3, color: '#ef4444' },
  { name: 'Não Existe/Mudou', position: 4, color: '#8b5cf6' },
] as const

export const PROTECTED_FUNNEL_NAMES = ['Atendimento Geral'] as const

export type WhatsAppCrmClient = Client & {
  whatsapp_stages: WhatsAppStage | null
}

export async function fetchWhatsAppFunnels(): Promise<WhatsAppFunnel[]> {
  const { data, error } = await supabase
    .from('whatsapp_funnels')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw error
  return (data ?? []) as WhatsAppFunnel[]
}

export async function fetchWhatsAppStages(funnelId?: string): Promise<WhatsAppStage[]> {
  let query = supabase.from('whatsapp_stages').select('*').order('position', { ascending: true })
  if (funnelId) query = query.eq('funnel_id', funnelId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as WhatsAppStage[]
}

export async function fetchWhatsAppCrmClients(funnelId?: string): Promise<WhatsAppCrmClient[]> {
  let query = supabase
    .from('clients')
    .select('*, whatsapp_stages(*)')
    .not('whatsapp_stage_id', 'is', null)
    .order('updated_at', { ascending: false })

  if (funnelId) {
    const { data: stages, error: stagesError } = await supabase
      .from('whatsapp_stages')
      .select('id')
      .eq('funnel_id', funnelId)

    if (stagesError) throw stagesError
    const stageIds = (stages ?? []).map((s) => s.id)
    if (stageIds.length === 0) return []
    query = query.in('whatsapp_stage_id', stageIds)
  }

  const { data, error } = await query
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

export async function createWhatsAppFunnel(name: string): Promise<WhatsAppFunnel> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Informe o nome do funil')

  const { count, error: countError } = await supabase
    .from('whatsapp_funnels')
    .select('*', { count: 'exact', head: true })

  if (countError) throw countError

  const { data: funnel, error } = await supabase
    .from('whatsapp_funnels')
    .insert({ name: trimmed, position: count ?? 0 })
    .select('*')
    .single()

  if (error) throw error

  const { error: stagesError } = await supabase.from('whatsapp_stages').insert(
    DEFAULT_FUNNEL_STAGES.map((stage) => ({
      funnel_id: funnel.id,
      name: stage.name,
      position: stage.position,
      color: stage.color,
    })),
  )

  if (stagesError) throw stagesError
  return funnel as WhatsAppFunnel
}

export async function deleteWhatsAppFunnel(funnelId: string): Promise<void> {
  const { data: funnel, error: fetchError } = await supabase
    .from('whatsapp_funnels')
    .select('name')
    .eq('id', funnelId)
    .single()

  if (fetchError) throw fetchError
  if (PROTECTED_FUNNEL_NAMES.includes(funnel.name as (typeof PROTECTED_FUNNEL_NAMES)[number])) {
    throw new Error('Este funil não pode ser excluído.')
  }

  const { error } = await supabase.from('whatsapp_funnels').delete().eq('id', funnelId)
  if (error) throw error
}

export async function createWhatsAppStage(
  funnelId: string,
  name: string,
  color: string,
): Promise<WhatsAppStage> {
  const { count, error: countError } = await supabase
    .from('whatsapp_stages')
    .select('*', { count: 'exact', head: true })
    .eq('funnel_id', funnelId)

  if (countError) throw countError

  const position = count ?? 0

  const { data, error } = await supabase
    .from('whatsapp_stages')
    .insert({ funnel_id: funnelId, name: name.trim(), color, position })
    .select('*')
    .single()

  if (error) throw error
  return data as WhatsAppStage
}

export function formatCrmError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Erro desconhecido ao acessar o CRM.'
  const e = error as { code?: string; message?: string; details?: string }

  if (e.code === '42P01' || e.message?.includes('whatsapp_stages') || e.message?.includes('whatsapp_funnels')) {
    return 'Tabelas do CRM não existem. Execute as migrations 004 e 007 no Supabase.'
  }
  if (e.code === '42703' || e.message?.includes('whatsapp_stage_id') || e.message?.includes('funnel_id')) {
    return 'Schema do CRM desatualizado. Execute as migrations 004 e 007 no Supabase.'
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
