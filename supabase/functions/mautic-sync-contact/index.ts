import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { mauticFetch } from '../_shared/mautic.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { client_id } = await req.json()
    if (!client_id) return errorResponse('client_id required')

    const supabase = getSupabaseAdmin()
    const { data: client, error } = await supabase.from('clients').select('*').eq('id', client_id).single()
    if (error || !client) return errorResponse('Client not found', 404)

    const payload = {
      firstname: client.name.split(' ')[0],
      lastname: client.name.split(' ').slice(1).join(' ') || '',
      email: client.email,
      phone: client.phone,
      company: client.company,
    }

    let mauticId = client.mautic_contact_id

    if (mauticId) {
      await mauticFetch(`/contacts/${mauticId}/edit`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    } else {
      const res = await mauticFetch('/contacts/new', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      mauticId = data.contact?.id
      if (mauticId) {
        await supabase.from('clients').update({ mautic_contact_id: mauticId }).eq('id', client_id)
      }
    }

    return jsonResponse({ success: true, mautic_contact_id: mauticId })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
