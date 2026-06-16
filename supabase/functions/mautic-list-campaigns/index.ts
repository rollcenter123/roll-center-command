import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { mauticFetch } from '../_shared/mautic.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    if (body.test) {
      const res = await mauticFetch('/campaigns?limit=1')
      return jsonResponse({ ok: res.ok })
    }

    const res = await mauticFetch('/campaigns?withContactCounts=true&limit=100')
    if (!res.ok) return errorResponse('Failed to fetch Mautic campaigns', res.status)

    const data = await res.json()
    const campaigns = Object.values(data.campaigns ?? {}).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      isPublished: c.isPublished,
      contactCount: c.contactCount,
    }))

    return jsonResponse({ campaigns })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
