import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getMauticCredentials, mauticFetch } from '../_shared/mautic.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const credentials = await getMauticCredentials()
    const res = await mauticFetch('/emails?limit=200')
    if (!res.ok) {
      const detail = await res.text()
      return errorResponse(
        `Falha ao buscar emails no Mautic (${credentials.source}): ${detail.slice(0, 200)}`,
        res.status,
      )
    }

    const payload = await res.json()
    const emails = Object.values(payload.emails ?? {}) as MauticEmailRecord[]

    const campaignEmails = emails.filter(
      (email) =>
        email.id &&
        (/reativa/i.test(email.name ?? '') || /disparo/i.test(email.lists?.[0]?.name ?? '')),
    )

    const sourceEmails = campaignEmails.length > 0
      ? campaignEmails
      : emails.filter((email) => email.id)

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()

    const rows = sourceEmails.map((email) => ({
        mautic_email_id: email.id!,
        nome: email.name ?? `Email ${email.id}`,
        assunto: email.subject ?? null,
        segmento:
          email.lists?.[0]?.name ??
          email.category?.title ??
          null,
        enviados: email.sentCount ?? 0,
        abertos: email.readCount ?? 0,
        publicado: email.isPublished ?? false,
        criado_em: email.publishUp || email.dateAdded || now,
        atualizado_em: now,
        synced_at: now,
      }))

    if (rows.length === 0) {
      return jsonResponse({ synced: 0, message: 'Nenhum email encontrado no Mautic' })
    }

    const { error } = await supabase
      .from('emails_mautic')
      .upsert(rows, { onConflict: 'mautic_email_id' })

    if (error) return errorResponse(error.message, 500)

    return jsonResponse({ synced: rows.length, source: credentials.source })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
