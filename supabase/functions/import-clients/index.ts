import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { normalizePhone } from '../_shared/phone.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

interface ImportClient {
  name: string
  email?: string
  phone?: string
  company?: string
  status?: string
  source?: string
  notes?: string
  custom_fields?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { clients } = await req.json() as { clients: ImportClient[] }
    if (!clients?.length) return errorResponse('No clients provided')

    const supabase = getSupabaseAdmin()
    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const client of clients) {
      try {
        const phone = client.phone ? normalizePhone(client.phone) : null

        const payload = {
          name: client.name,
          email: client.email || null,
          phone,
          company: client.company || null,
          status: client.status || 'lead',
          source: client.source || (phone ? 'importação' : null),
          notes: client.notes || null,
          custom_fields: client.custom_fields || {},
        }

        if (client.email) {
          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('email', client.email)
            .single()

          if (existing) {
            await supabase.from('clients').update(payload).eq('id', existing.id)
            imported++
            continue
          }
        }

        if (phone) {
          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', phone)
            .single()

          if (existing) {
            skipped++
            continue
          }
        }

        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
        imported++
      } catch (e) {
        errors.push(`${client.name}: ${e instanceof Error ? e.message : 'error'}`)
      }
    }

    return jsonResponse({ imported, skipped, errors })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
