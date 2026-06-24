import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyAdmin } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const GRAPH_API_VERSION = 'v21.0'

interface SessionInfo {
  waba_id?: string
  phone_number_id?: string
  business_id?: string
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = Deno.env.get('FACEBOOK_APP_ID') ?? Deno.env.get('VITE_FACEBOOK_APP_ID')
  const appSecret = Deno.env.get('FACEBOOK_APP_SECRET')
  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID e FACEBOOK_APP_SECRET devem estar configurados nos Secrets')
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  })

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?${params}`)
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? 'Falha ao trocar code por access token')
  }
  return data.access_token as string
}

async function fetchPhoneNumberId(wabaId: string, accessToken: string): Promise<string | null> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/phone_numbers?access_token=${accessToken}`,
  )
  const data = await res.json()
  if (!res.ok) return null
  return data.data?.[0]?.id ?? null
}

async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = await verifyAdmin(req)
    if (!admin) return errorResponse('Não autorizado', 401)

    const body = await req.json()
    const { code, waba_id, phone_number_id, business_id } = body as {
      code?: string
      waba_id?: string
      phone_number_id?: string
      business_id?: string
    }

    if (!code) return errorResponse('code é obrigatório')

    const sessionInfo: SessionInfo = { waba_id, phone_number_id, business_id }
    const accessToken = await exchangeCodeForToken(code)

    let wabaId = sessionInfo.waba_id
    let phoneNumberId = sessionInfo.phone_number_id

    if (wabaId && !phoneNumberId) {
      phoneNumberId = (await fetchPhoneNumberId(wabaId, accessToken)) ?? undefined
    }

    if (!wabaId || !phoneNumberId) {
      return errorResponse(
        'Não foi possível obter WABA ID ou Phone Number ID. Tente conectar novamente.',
        422,
      )
    }

    await subscribeAppToWaba(wabaId, accessToken)

    const supabase = getSupabaseAdmin()
    const config = {
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      business_id: sessionInfo.business_id ?? null,
      access_token: accessToken,
      connected_at: new Date().toISOString(),
      connection_method: 'embedded_signup',
    }

    const { error } = await supabase.from('integration_settings').upsert(
      { provider: 'whatsapp_cloud', config, is_active: true },
      { onConflict: 'provider' },
    )
    if (error) throw error

    return jsonResponse({
      ok: true,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      business_id: sessionInfo.business_id ?? null,
    })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Erro desconhecido', 500)
  }
})
