/**
 * Mapeamento de etapas exportadas do Go42 para etapas do CRM Roll Center.
 */
export const GO42_STAGE_ALIASES: Record<string, string> = {
  disparado: 'Disparado',
  respondeu: 'Respondeu',
  'respondeu disparo': 'Respondeu',
  cotou: 'Cotou',
  'não quer': 'Não Quer',
  'nao quer': 'Não Quer',
  'não existe/mudou': 'Não Existe/Mudou',
  'nao existe/mudou': 'Não Existe/Mudou',
}

export const GO42_DEFAULT_FUNNEL = 'Disparo Base'

/** IDs de membro exportados do Go42 → funil interno */
export const GO42_MEMBER_FUNNEL_MAP: Record<string, string> = {
  'd4cac14e-5abf-4765-aec6-94cf6df0320d': 'Disparos Felipe',
  '74c4dae8-3726-47ca-8c6a-7c3bd48cbf82': 'Disparos Luis Gustavo',
}

export function resolveGo42Funnel(input: {
  crmFunnel: string | null
  teamMemberId: string | null
}): string {
  if (input.crmFunnel?.trim()) return input.crmFunnel.trim()
  if (input.teamMemberId && GO42_MEMBER_FUNNEL_MAP[input.teamMemberId]) {
    return GO42_MEMBER_FUNNEL_MAP[input.teamMemberId]
  }
  return GO42_DEFAULT_FUNNEL
}

export function normalizeGo42StageName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase()
  return GO42_STAGE_ALIASES[key] ?? trimmed
}

export const GO42_COLUMN_MAP: Record<string, string> = {
  'nome do lead': 'name',
  nome: 'name',
  name: 'name',
  telefone: 'phone',
  phone: 'phone',
  origem: 'source',
  source: 'source',
  'etapa do crm': 'crm_stage',
  'funil do crm': 'crm_funnel',
  funil: 'crm_funnel',
  'membro da equipe': 'team_member_id',
  etiquetas: 'tags',
  'última mensagem': 'notes',
  'ultima mensagem': 'notes',
  observacoes: 'notes',
  observações: 'notes',
}

export interface Go42ImportRow {
  name: string
  phone: string | null
  source: string | null
  crmStage: string | null
  crmFunnel: string | null
  teamMemberId: string | null
  notes: string | null
  tags: string[]
  custom_fields: Record<string, unknown>
}

export function mapGo42ImportRow(raw: Record<string, unknown>): Go42ImportRow | null {
  const mapped: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.toLowerCase().trim()
    const field = GO42_COLUMN_MAP[normalized]
    if (field) mapped[field] = value
    else if (value !== null && value !== undefined && value !== '') custom[key] = value
  }

  const name = String(mapped.name ?? '').trim()
  if (!name) return null

  const tagsRaw = String(mapped.tags ?? '').trim()
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []
  const teamMemberRaw = mapped.team_member_id ? String(mapped.team_member_id).trim() : ''
  const teamMemberId = teamMemberRaw || null
  const crmFunnelExplicit = mapped.crm_funnel ? String(mapped.crm_funnel).trim() : null

  return {
    name,
    phone: mapped.phone ? String(mapped.phone).trim() : null,
    source: mapped.source ? String(mapped.source).trim() : null,
    crmStage: normalizeGo42StageName(mapped.crm_stage ? String(mapped.crm_stage) : null),
    crmFunnel: resolveGo42Funnel({ crmFunnel: crmFunnelExplicit, teamMemberId }),
    teamMemberId,
    notes: mapped.notes ? String(mapped.notes).trim() : null,
    tags,
    custom_fields: custom,
  }
}
