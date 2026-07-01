import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizePhone } from './phone.ts'

export const MAUTIC_FROM_EMAIL = 'tecnologiarollcenter@gmail.com'

interface MauticEmailRecord {
  id?: number
  name?: string
  subject?: string
  sentCount?: number
  readCount?: number
  isPublished?: boolean
  dateAdded?: string
  publishUp?: string | null
  fromAddress?: string
  fromEmail?: string
  replyToAddress?: string
  lists?: Array<{ id?: number; name?: string }>
  category?: { title?: string } | null
}

interface MauticEmailStat {
  id?: string | number
  email_id?: string | number
  lead_id?: string | number
  email_address?: string
  date_sent?: string
  date_read?: string | null
  is_read?: boolean | string | number
  is_failed?: boolean | string | number
}

interface WidgetSendRow {
  contact_id?: string | number
  contact_email?: string
  email_id?: string | number
  date_sent?: string
  date_read?: string | null
  open?: string | number | boolean
}

type MauticFetch = (path: string, options?: RequestInit) => Promise<Response>

const SYNC_CONFIG_KEY = 'email_stats_sync'
const PAGE_SIZE = 200
const MAX_SENDS_PER_RUN = 400

function fieldValue(fields: Record<string, unknown> | undefined, key: string): string {
  if (!fields) return ''
  const raw = fields[key]
  if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
    return String((raw as { value?: unknown }).value ?? '').trim()
  }
  return raw != null ? String(raw).trim() : ''
}

function parseBool(value: boolean | string | number | undefined): boolean {
  return value === true || value === 1 || value === '1'
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function emailFromAddress(email: MauticEmailRecord): string {
  return String(email.fromAddress ?? email.fromEmail ?? email.replyToAddress ?? '').toLowerCase()
}

function matchesRollCenterSender(email: MauticEmailRecord): boolean {
  const from = emailFromAddress(email)
  if (!from) return true
  return from.includes('tecnologiarollcenter@gmail.com') || from.includes('rollcenter')
}

async function getSyncCursor(supabase: SupabaseClient): Promise<{ lastStatId: number; lastSyncAt: string | null }> {
  const { data } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('provider', 'mautic')
    .maybeSingle()

  const config = (data?.config ?? {}) as Record<string, unknown>
  const syncConfig = (config[SYNC_CONFIG_KEY] ?? {}) as Record<string, unknown>

  return {
    lastStatId: Number(syncConfig.last_stat_id ?? 0),
    lastSyncAt: typeof syncConfig.last_sync_at === 'string' ? syncConfig.last_sync_at : null,
  }
}

async function saveSyncCursor(
  supabase: SupabaseClient,
  lastStatId: number,
  lastSyncAt: string,
) {
  const { data } = await supabase
    .from('integration_settings')
    .select('id, config')
    .eq('provider', 'mautic')
    .maybeSingle()

  const config = { ...((data?.config ?? {}) as Record<string, unknown>) }
  config[SYNC_CONFIG_KEY] = {
    last_stat_id: lastStatId,
    last_sync_at: lastSyncAt,
  }
  config.from_email = MAUTIC_FROM_EMAIL

  if (data?.id) {
    await supabase
      .from('integration_settings')
      .update({ config })
      .eq('id', data.id)
    return
  }

  await supabase
    .from('integration_settings')
    .insert({
      provider: 'mautic',
      config,
      is_active: true,
    })
}

export async function syncMauticEmailCatalog(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
): Promise<number> {
  const res = await mauticFetch('/emails?limit=500')
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Falha ao buscar emails no Mautic: ${detail.slice(0, 200)}`)
  }

  const payload = await res.json()
  const emails = Object.values(payload.emails ?? {}) as MauticEmailRecord[]

  const rollCenterEmails = emails.filter((email) => email.id && matchesRollCenterSender(email))
  const sentEmails = rollCenterEmails.filter((email) => (email.sentCount ?? 0) > 0)
  const rowsSource = sentEmails.length > 0
    ? sentEmails
    : rollCenterEmails.length > 0
    ? rollCenterEmails
    : emails.filter((email) => email.id)

  if (rowsSource.length === 0) return 0

  const now = new Date().toISOString()
  const rows = rowsSource.map((email) => ({
    mautic_email_id: email.id!,
    nome: email.name ?? `Email ${email.id}`,
    assunto: email.subject ?? null,
    segmento: email.lists?.[0]?.name ?? email.category?.title ?? null,
    enviados: email.sentCount ?? 0,
    abertos: email.readCount ?? 0,
    publicado: email.isPublished ?? false,
    criado_em: email.publishUp || email.dateAdded || now,
    atualizado_em: now,
    synced_at: now,
  }))

  const { error } = await supabase
    .from('emails_mautic')
    .upsert(rows, { onConflict: 'mautic_email_id' })

  if (error) throw new Error(error.message)
  return rows.length
}

async function findOrCreateClientForMauticContact(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
  mauticContactId: number,
  emailAddress: string,
  cache: Map<number, string | null>,
): Promise<string | null> {
  const cached = cache.get(mauticContactId)
  if (cached !== undefined) return cached

  const { data: byMautic } = await supabase
    .from('clients')
    .select('id, mautic_contact_id')
    .eq('mautic_contact_id', mauticContactId)
    .maybeSingle()

  if (byMautic?.id) {
    cache.set(mauticContactId, byMautic.id)
    return byMautic.id
  }

  const normalizedEmail = emailAddress.trim().toLowerCase()

  if (normalizedEmail) {
    const { data: byEmail } = await supabase
      .from('clients')
      .select('id, mautic_contact_id')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (byEmail?.id) {
      if (!byEmail.mautic_contact_id) {
        await supabase
          .from('clients')
          .update({ mautic_contact_id: mauticContactId })
          .eq('id', byEmail.id)
      }
      cache.set(mauticContactId, byEmail.id)
      return byEmail.id
    }

    const { data: createdFromEmail, error: createError } = await supabase
      .from('clients')
      .insert({
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        mautic_contact_id: mauticContactId,
        source: 'mautic',
        email_opt_in: true,
        whatsapp_opt_in: false,
        status: 'lead',
      })
      .select('id')
      .single()

    if (!createError && createdFromEmail?.id) {
      cache.set(mauticContactId, createdFromEmail.id)
      return createdFromEmail.id
    }

    if (createError) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (existing?.id) {
        cache.set(mauticContactId, existing.id)
        return existing.id
      }
    }
  }

  const contactRes = await mauticFetch(`/contacts/${mauticContactId}`)
  if (!contactRes.ok) {
    cache.set(mauticContactId, null)
    return null
  }

  const contactPayload = await contactRes.json()
  const contact = contactPayload.contact as Record<string, unknown> | undefined
  const fields = (contact?.fields as Record<string, Record<string, unknown>> | undefined)?.all
    ?? (contact?.fields as Record<string, Record<string, unknown>> | undefined)?.core
    ?? {}

  const firstName = fieldValue(fields, 'firstname')
  const lastName = fieldValue(fields, 'lastname')
  const email = fieldValue(fields, 'email') || emailAddress.toLowerCase()
  const phoneRaw = fieldValue(fields, 'phone') || fieldValue(fields, 'mobile')
  const company = fieldValue(fields, 'company') || null
  const name = `${firstName} ${lastName}`.trim() || email || `Contato ${mauticContactId}`

  if (!email) {
    cache.set(mauticContactId, null)
    return null
  }

  const { data: created, error } = await supabase
    .from('clients')
    .insert({
      name,
      email,
      phone: phoneRaw ? normalizePhone(phoneRaw) : null,
      company,
      mautic_contact_id: mauticContactId,
      source: 'mautic',
      email_opt_in: true,
      whatsapp_opt_in: false,
      status: 'lead',
    })
    .select('id')
    .single()

  if (error) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    const clientId = existing?.id ?? null
    cache.set(mauticContactId, clientId)
    return clientId
  }

  cache.set(mauticContactId, created.id)
  return created.id
}

interface SendRowInput {
  mauticStatId?: number | null
  mauticEmailId: number
  mauticContactId: number
  emailAddress: string
  sentAt?: string | null
  openedAt?: string | null
  isRead?: boolean
  isFailed?: boolean
}

async function persistSendRows(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
  inputs: SendRowInput[],
  clientCache: Map<number, string | null>,
): Promise<{ sendsSynced: number; clientsLinked: number }> {
  let sendsSynced = 0
  let clientsLinked = 0
  const rows = []

  for (const input of inputs) {
    const clientId = await findOrCreateClientForMauticContact(
      supabase,
      mauticFetch,
      input.mauticContactId,
      input.emailAddress,
      clientCache,
    )

    if (clientId) clientsLinked += 1

    rows.push({
      mautic_email_id: input.mauticEmailId,
      mautic_contact_id: input.mauticContactId,
      client_id: clientId,
      email_address: input.emailAddress.toLowerCase(),
      status: input.isFailed ? 'failed' : input.isRead ? 'opened' : 'sent',
      sent_at: toIsoDate(input.sentAt),
      opened_at: toIsoDate(input.openedAt),
      is_read: input.isRead ?? false,
      synced_at: new Date().toISOString(),
    })
  }

  if (rows.length === 0) return { sendsSynced: 0, clientsLinked: 0 }

  const { error } = await supabase
    .from('mautic_email_sends')
    .upsert(rows, { onConflict: 'mautic_email_id,mautic_contact_id' })

  if (error) throw new Error(error.message)

  return { sendsSynced: rows.length, clientsLinked }
}

function buildStatsPath(start: number, lastStatId: number, emailId?: number): string {
  const params = new URLSearchParams()
  params.set('start', String(start))
  params.set('limit', String(PAGE_SIZE))
  params.set('order[0][col]', 'id')
  params.set('order[0][dir]', 'asc')

  let whereIndex = 0
  if (lastStatId > 0) {
    params.set(`where[${whereIndex}][col]`, 'id')
    params.set(`where[${whereIndex}][expr]`, 'gt')
    params.set(`where[${whereIndex}][val]`, String(lastStatId))
    whereIndex += 1
  }

  if (emailId) {
    params.set(`where[${whereIndex}][col]`, 'email_id')
    params.set(`where[${whereIndex}][expr]`, 'eq')
    params.set(`where[${whereIndex}][val]`, String(emailId))
  }

  return `/stats/email_stats?${params.toString()}`
}

async function syncViaEmailStats(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
  lastStatId: number,
  emailId?: number,
): Promise<{ sendsSynced: number; clientsLinked: number; highestStatId: number }> {
  const clientCache = new Map<number, string | null>()
  let start = 0
  let sendsSynced = 0
  let clientsLinked = 0
  let highestStatId = lastStatId

  while (sendsSynced < MAX_SENDS_PER_RUN) {
    const res = await mauticFetch(buildStatsPath(start, emailId ? 0 : lastStatId, emailId))
    if (!res.ok) break

    const payload = await res.json()
    const stats = (payload.stats ?? []) as MauticEmailStat[]
    if (stats.length === 0) break

    const inputs: SendRowInput[] = []

    for (const stat of stats) {
      const statId = Number(stat.id)
      const mauticEmailId = Number(stat.email_id)
      const mauticContactId = Number(stat.lead_id)
      const emailAddress = String(stat.email_address ?? '').trim()

      if (!statId || !mauticEmailId || !mauticContactId || !emailAddress) continue

      highestStatId = Math.max(highestStatId, statId)
      inputs.push({
        mauticStatId: statId,
        mauticEmailId,
        mauticContactId,
        emailAddress,
        sentAt: stat.date_sent,
        openedAt: stat.date_read,
        isRead: parseBool(stat.is_read),
        isFailed: parseBool(stat.is_failed),
      })
    }

    const result = await persistSendRows(supabase, mauticFetch, inputs, clientCache)
    sendsSynced += result.sendsSynced
    clientsLinked += result.clientsLinked

    if (stats.length < PAGE_SIZE) break
    start += PAGE_SIZE
  }

  return { sendsSynced, clientsLinked, highestStatId }
}

function yearRanges(): Array<{ from: string; to: string }> {
  const currentYear = new Date().getFullYear()
  const ranges: Array<{ from: string; to: string }> = []

  for (let year = currentYear - 3; year <= currentYear; year += 1) {
    ranges.push({
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    })
  }

  return ranges
}

async function syncViaSentEmailWidget(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
): Promise<{ sendsSynced: number; clientsLinked: number }> {
  const clientCache = new Map<number, string | null>()
  let sendsSynced = 0
  let clientsLinked = 0
  const seen = new Set<string>()

  for (const range of yearRanges()) {
    const params = new URLSearchParams({
      dateFrom: range.from,
      dateTo: range.to,
      limit: '5000',
      offset: '0',
    })

    const res = await mauticFetch(`/data/sent.email.to.contacts?${params.toString()}`)
    if (!res.ok) continue

    const payload = await res.json()
    const bodyItems = (payload.data?.bodyItems ?? payload.bodyItems ?? {}) as Record<string, WidgetSendRow>
    const inputs: SendRowInput[] = []

    for (const row of Object.values(bodyItems)) {
      const mauticContactId = Number(row.contact_id)
      const mauticEmailId = Number(row.email_id)
      const emailAddress = String(row.contact_email ?? '').trim().toLowerCase()

      if (!mauticContactId || !mauticEmailId || !emailAddress) continue
      if (emailAddress === MAUTIC_FROM_EMAIL) continue

      const dedupeKey = `${mauticEmailId}:${mauticContactId}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      inputs.push({
        mauticEmailId,
        mauticContactId,
        emailAddress,
        sentAt: row.date_sent,
        openedAt: row.date_read,
        isRead: parseBool(row.open),
      })
    }

    if (inputs.length === 0) continue

    const remaining = MAX_SENDS_PER_RUN - sendsSynced
    if (remaining <= 0) break

    const result = await persistSendRows(
      supabase,
      mauticFetch,
      inputs.slice(0, remaining),
      clientCache,
    )
    sendsSynced += result.sendsSynced
    clientsLinked += result.clientsLinked

    if (sendsSynced >= MAX_SENDS_PER_RUN) break
  }

  return { sendsSynced, clientsLinked }
}

async function syncViaCatalogEmails(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
): Promise<{ sendsSynced: number; clientsLinked: number }> {
  const { data: catalog } = await supabase
    .from('emails_mautic')
    .select('mautic_email_id, enviados')
    .gt('enviados', 0)
    .order('mautic_email_id', { ascending: true })

  let sendsSynced = 0
  let clientsLinked = 0

  for (const email of catalog ?? []) {
    const result = await syncViaEmailStats(
      supabase,
      mauticFetch,
      0,
      email.mautic_email_id as number,
    )
    sendsSynced += result.sendsSynced
    clientsLinked += result.clientsLinked
    if (sendsSynced >= MAX_SENDS_PER_RUN) break
  }

  return { sendsSynced, clientsLinked }
}

export async function syncMauticEmailSends(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
): Promise<{
  sendsSynced: number
  clientsLinked: number
  lastStatId: number
  syncMethod: string
}> {
  const cursor = await getSyncCursor(supabase)

  let sendsSynced = 0
  let clientsLinked = 0
  let highestStatId = cursor.lastStatId
  let syncMethod = 'none'

  const statsResult = await syncViaEmailStats(supabase, mauticFetch, cursor.lastStatId)
  sendsSynced += statsResult.sendsSynced
  clientsLinked += statsResult.clientsLinked
  highestStatId = Math.max(highestStatId, statsResult.highestStatId)

  if (statsResult.sendsSynced > 0) {
    syncMethod = 'email_stats'
  }

  if (sendsSynced === 0) {
    const widgetResult = await syncViaSentEmailWidget(supabase, mauticFetch)
    sendsSynced += widgetResult.sendsSynced
    clientsLinked += widgetResult.clientsLinked
    if (widgetResult.sendsSynced > 0) syncMethod = 'sent.email.to.contacts'
  }

  if (sendsSynced === 0) {
    const perEmailResult = await syncViaCatalogEmails(supabase, mauticFetch)
    sendsSynced += perEmailResult.sendsSynced
    clientsLinked += perEmailResult.clientsLinked
    if (perEmailResult.sendsSynced > 0) syncMethod = 'per_email_stats'
    if (sendsSynced >= MAX_SENDS_PER_RUN) syncMethod += ' (parcial)'
  }

  await saveSyncCursor(supabase, highestStatId, new Date().toISOString())

  return {
    sendsSynced,
    clientsLinked,
    lastStatId: highestStatId,
    syncMethod,
  }
}

export async function upsertMauticEmailSend(
  supabase: SupabaseClient,
  mauticFetch: MauticFetch,
  input: {
    mauticContactId: number
    mauticEmailId?: number | null
    emailAddress?: string | null
    sentAt?: string | null
    status?: string
    openedAt?: string | null
    isRead?: boolean
    mauticStatId?: number | null
  },
): Promise<string | null> {
  const emailAddress = String(input.emailAddress ?? '').trim()
  if (!input.mauticContactId || !emailAddress) return null

  const clientId = await findOrCreateClientForMauticContact(
    supabase,
    mauticFetch,
    input.mauticContactId,
    emailAddress,
    new Map(),
  )

  if (!input.mauticEmailId) return clientId

  const payload = {
    mautic_stat_id: input.mauticStatId ?? null,
    mautic_email_id: input.mauticEmailId,
    mautic_contact_id: input.mauticContactId,
    client_id: clientId,
    email_address: emailAddress.toLowerCase(),
    status: input.status ?? 'sent',
    sent_at: input.sentAt ?? new Date().toISOString(),
    opened_at: input.openedAt ?? null,
    is_read: input.isRead ?? false,
    synced_at: new Date().toISOString(),
  }

  await supabase
    .from('mautic_email_sends')
    .upsert(payload, { onConflict: 'mautic_email_id,mautic_contact_id' })

  return clientId
}

export async function resetMauticEmailSyncCursor(supabase: SupabaseClient) {
  await saveSyncCursor(supabase, 0, new Date(0).toISOString())
}
