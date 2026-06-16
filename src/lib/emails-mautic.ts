import { supabase } from '@/lib/supabase'
import { toDateInputValue } from '@/lib/utils'
import type { MauticEmail } from '@/types/database'

export interface EmailDayRow extends MauticEmail {
  dateKey: string
  dayNumber: number
}

export function extractDayNumber(nome: string, segmento?: string | null): number | null {
  const source = `${nome} ${segmento ?? ''}`
  const match = source.match(/dia\s*0*(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

/** Nome base da campanha sem o sufixo do dia (ex.: "Reativação dia005" → "Reativação") */
export function extractCampaignName(nome: string): string {
  return nome.replace(/\s*dia\s*0*\d+\s*$/i, '').trim() || nome
}

export async function fetchEmailsMautic() {
  const { data, error } = await supabase
    .from('emails_mautic')
    .select('id, nome, assunto, segmento, enviados, abertos, criado_em, synced_at')
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as MauticEmail[]
}

export async function syncEmailsFromMautic() {
  const { data, error } = await supabase.functions.invoke('mautic-sync-emails')

  if (error) {
    throw new Error(
      `${error.message}. Se persistir, rode no terminal: npm run sync:emails (com as credenciais no .env)`,
    )
  }

  if (data?.error) throw new Error(String(data.error))
  return data as { synced: number }
}

export function toLocalDateKey(value: string): string {
  return toDateInputValue(new Date(value))
}

export function parseInputDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function buildDayRows(emails: MauticEmail[]): EmailDayRow[] {
  const rows = emails
    .map((email) => {
      const dayFromName = extractDayNumber(email.nome, email.segmento)
      const dateSource = email.criado_em ?? email.synced_at
      const dateKey = dateSource ? toLocalDateKey(dateSource) : null

      if (!dateKey && dayFromName === null) return null

      return {
        ...email,
        dateKey: dateKey ?? toDateInputValue(new Date()),
        dayNumber: dayFromName ?? 0,
      }
    })
    .filter((row): row is EmailDayRow => row !== null)
    .sort((a, b) => {
      if (a.dayNumber && b.dayNumber) return a.dayNumber - b.dayNumber
      return new Date(a.criado_em ?? a.synced_at ?? 0).getTime() - new Date(b.criado_em ?? b.synced_at ?? 0).getTime()
    })

  return rows.map((row, index) => ({
    ...row,
    dayNumber: row.dayNumber || index + 1,
  }))
}

export function filterByRange(rows: EmailDayRow[], start: string, end: string) {
  return rows.filter((row) => row.dateKey >= start && row.dateKey <= end)
}

export function sumMetrics(rows: Pick<EmailDayRow, 'enviados' | 'abertos'>[]) {
  return rows.reduce(
    (acc, row) => ({
      enviados: acc.enviados + (row.enviados ?? 0),
      abertos: acc.abertos + (row.abertos ?? 0),
    }),
    { enviados: 0, abertos: 0 },
  )
}
