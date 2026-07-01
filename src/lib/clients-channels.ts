import { supabase } from '@/lib/supabase'
import type { Client } from '@/types/database'

export type ClientChannelTab = 'whatsapp' | 'email'

export interface WhatsAppConversationLink {
  client_id: string | null
  wa_phone: string
}

export interface EmailChannelClient extends Client {
  emails_sent: number
  last_email_sent_at: string | null
}

export async function fetchWhatsAppConversationLinks(): Promise<WhatsAppConversationLink[]> {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('client_id, wa_phone')

  if (error) throw error
  return (data ?? []) as WhatsAppConversationLink[]
}

export function isWhatsAppChannelClient(client: Client): boolean {
  return Boolean(client.phone?.trim())
}

export function filterWhatsAppClients(clients: Client[]): Client[] {
  return clients.filter(isWhatsAppChannelClient)
}

function accumulateEmailStats(
  byClient: Map<string, { count: number; lastSent: string | null }>,
  clientId: string,
  sentAt: string | null,
) {
  const current = byClient.get(clientId) ?? { count: 0, lastSent: null }
  current.count += 1
  if (sentAt && (!current.lastSent || sentAt > current.lastSent)) {
    current.lastSent = sentAt
  }
  byClient.set(clientId, current)
}

export async function fetchEmailChannelClients(): Promise<EmailChannelClient[]> {
  const byClient = new Map<string, { count: number; lastSent: string | null }>()
  const byEmail = new Map<string, { count: number; lastSent: string | null }>()

  const { data: sends, error: sendsError } = await supabase
    .from('mautic_email_sends')
    .select('client_id, email_address, sent_at')

  if (sendsError) {
    if (sendsError.code === 'PGRST205') return []
    throw sendsError
  }

  for (const row of sends ?? []) {
    const sentAt = row.sent_at as string | null
    if (row.client_id) {
      accumulateEmailStats(byClient, row.client_id as string, sentAt)
      continue
    }

    const email = String(row.email_address ?? '').toLowerCase()
    if (!email) continue
    const current = byEmail.get(email) ?? { count: 0, lastSent: null }
    current.count += 1
    if (sentAt && (!current.lastSent || sentAt > current.lastSent)) {
      current.lastSent = sentAt
    }
    byEmail.set(email, current)
  }

  const clientIds = [...byClient.keys()]
  const orphanEmails = [...byEmail.keys()]

  if (clientIds.length === 0 && orphanEmails.length === 0) {
    const { data: recipients, error: recipientsError } = await supabase
      .from('campaign_recipients')
      .select('client_id, sent_at, campaigns!inner(channel)')
      .eq('campaigns.channel', 'email')
      .neq('status', 'pending')

    if (recipientsError) throw recipientsError

    for (const row of recipients ?? []) {
      accumulateEmailStats(byClient, row.client_id as string, row.sent_at as string | null)
    }
  } else if (clientIds.length > 0 || orphanEmails.length > 0) {
    const { data: recipients, error: recipientsError } = await supabase
      .from('campaign_recipients')
      .select('client_id, sent_at, campaigns!inner(channel)')
      .eq('campaigns.channel', 'email')
      .neq('status', 'pending')

    if (!recipientsError) {
      for (const row of recipients ?? []) {
        accumulateEmailStats(byClient, row.client_id as string, row.sent_at as string | null)
      }
    }
  }

  const resolvedIds = new Set([...byClient.keys()])
  if (orphanEmails.length > 0) {
    const { data: matchedClients } = await supabase
      .from('clients')
      .select('id, email')
      .in('email', orphanEmails)

    for (const client of matchedClients ?? []) {
      if (!client.email || resolvedIds.has(client.id)) continue
      const stats = byEmail.get(client.email.toLowerCase())
      if (!stats) continue
      const current = byClient.get(client.id) ?? { count: 0, lastSent: null }
      current.count += stats.count
      if (stats.lastSent && (!current.lastSent || stats.lastSent > current.lastSent)) {
        current.lastSent = stats.lastSent
      }
      byClient.set(client.id, current)
      resolvedIds.add(client.id)
    }
  }

  const finalClientIds = [...resolvedIds]
  if (finalClientIds.length === 0) return []

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .in('id', finalClientIds)
    .order('name', { ascending: true })

  if (clientsError) throw clientsError

  return (clients ?? []).map((client) => {
    const stats = byClient.get(client.id)!
    return {
      ...(client as Client),
      emails_sent: stats.count,
      last_email_sent_at: stats.lastSent,
    }
  })
}

export function filterEmailClients(
  clients: EmailChannelClient[],
  search: string,
  statusFilter: string,
): EmailChannelClient[] {
  const term = search.trim().toLowerCase()

  return clients.filter((client) => {
    if (statusFilter && client.status !== statusFilter) return false
    if (!term) return true

    return (
      client.name.toLowerCase().includes(term)
      || (client.email?.toLowerCase().includes(term) ?? false)
      || (client.company?.toLowerCase().includes(term) ?? false)
    )
  })
}
