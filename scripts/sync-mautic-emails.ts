import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(import.meta.dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const baseUrl = process.env.MAUTIC_BASE_URL!
const mauticUser = process.env.MAUTIC_USER
const mauticPassword = process.env.MAUTIC_PASSWORD
const clientId = process.env.MAUTIC_CLIENT_ID
const clientSecret = process.env.MAUTIC_CLIENT_SECRET

if (!supabaseUrl || !serviceKey) {
  console.error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

if (!baseUrl) {
  console.error('Configure MAUTIC_BASE_URL no .env')
  process.exit(1)
}

const hasBasicAuth = Boolean(mauticUser && mauticPassword)
const hasOAuth = Boolean(clientId && clientSecret)

if (!hasBasicAuth && !hasOAuth) {
  console.error('Configure MAUTIC_USER + MAUTIC_PASSWORD ou MAUTIC_CLIENT_ID + MAUTIC_CLIENT_SECRET no .env')
  process.exit(1)
}

interface MauticEmailRecord {
  id?: number
  name?: string
  subject?: string
  sentCount?: number
  readCount?: number
  isPublished?: boolean
  dateAdded?: string
  publishUp?: string | null
  lists?: Array<{ name?: string }>
  category?: { title?: string } | null
}

async function getMauticAuthHeader(): Promise<string> {
  if (mauticUser && mauticPassword) {
    return `Basic ${Buffer.from(`${mauticUser}:${mauticPassword}`).toString('base64')}`
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  })

  if (!res.ok) {
    throw new Error(`Mautic auth failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return `Bearer ${data.access_token as string}`
}

async function fetchMauticEmails(authHeader: string): Promise<MauticEmailRecord[]> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/emails?limit=200`, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Mautic emails failed: ${res.status} ${await res.text()}`)
  }

  const payload = await res.json()
  return Object.values(payload.emails ?? {}) as MauticEmailRecord[]
}

async function main() {
  console.log('Autenticando no Mautic...')
  const authHeader = await getMauticAuthHeader()

  console.log('Buscando emails...')
  const emails = await fetchMauticEmails(authHeader)
  const campaignEmails = emails.filter(
    (email) =>
      email.id &&
      (/reativa/i.test(email.name ?? '') || /disparo/i.test(email.lists?.[0]?.name ?? '')),
  )

  const rows = (campaignEmails.length > 0 ? campaignEmails : emails.filter((e) => e.id)).map(
    (email) => {
      const now = new Date().toISOString()
      return {
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
      }
    },
  )

  console.log(`Encontrados ${rows.length} email(s) no Mautic:`)
  rows.forEach((row) => console.log(`  - ${row.nome} | enviados=${row.enviados} | ${row.criado_em}`))

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('emails_mautic').upsert(rows, { onConflict: 'mautic_email_id' })

  if (error) {
    console.error('Erro ao gravar no Supabase:', error.message)
    process.exit(1)
  }

  console.log(`\nSincronização concluída: ${rows.length} registro(s) atualizado(s).`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
