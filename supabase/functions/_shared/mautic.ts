let cachedToken: { token: string; expiresAt: number } | null = null

function getMauticBaseUrl(): string {
  const baseUrl = Deno.env.get('MAUTIC_BASE_URL')
  if (!baseUrl) throw new Error('MAUTIC_BASE_URL não configurado nos Secrets do Supabase')
  return baseUrl.replace(/\/$/, '')
}

function getBasicAuthHeader(): string | null {
  const user = Deno.env.get('MAUTIC_USER')
  const password = Deno.env.get('MAUTIC_PASSWORD')
  if (!user || !password) return null
  return `Basic ${btoa(`${user}:${password}`)}`
}

async function getOAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const clientId = Deno.env.get('MAUTIC_CLIENT_ID')
  const clientSecret = Deno.env.get('MAUTIC_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error(
      'Configure MAUTIC_USER + MAUTIC_PASSWORD ou MAUTIC_CLIENT_ID + MAUTIC_CLIENT_SECRET nos Secrets',
    )
  }

  const baseUrl = getMauticBaseUrl()
  const res = await fetch(`${baseUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) throw new Error(`Mautic OAuth falhou: ${res.status}`)
  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.token
}

async function getAuthHeader(): Promise<string> {
  const basic = getBasicAuthHeader()
  if (basic) return basic
  const token = await getOAuthToken()
  return `Bearer ${token}`
}

export async function mauticFetch(path: string, options: RequestInit = {}) {
  const baseUrl = getMauticBaseUrl()
  const authorization = await getAuthHeader()

  const res = await fetch(`${baseUrl}/api${path}`, {
    ...options,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res
}
