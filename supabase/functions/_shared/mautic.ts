import { getSupabaseAdmin } from './supabase-admin.ts'

export interface MauticCredentials {
  baseUrl: string
  user?: string
  password?: string
  clientId?: string
  clientSecret?: string
  source: 'database' | 'env'
}

let cachedToken: { key: string; token: string; expiresAt: number } | null = null

export async function getMauticCredentials(): Promise<MauticCredentials> {
  const supabase = getSupabaseAdmin()
  const { data: setting } = await supabase
    .from('integration_settings')
    .select('config, is_active')
    .eq('provider', 'mautic')
    .maybeSingle()

  const config = setting?.config as Record<string, string> | undefined
  if (setting?.is_active && config?.base_url) {
    return {
      baseUrl: config.base_url.replace(/\/$/, ''),
      user: config.user,
      password: config.password,
      clientId: config.client_id,
      clientSecret: config.client_secret,
      source: 'database',
    }
  }

  const baseUrl = Deno.env.get('MAUTIC_BASE_URL')
  if (!baseUrl) {
    throw new Error(
      'Mautic não configurado. Salve a integração em Integrações ou configure MAUTIC_BASE_URL nos Secrets do Supabase.',
    )
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    user: Deno.env.get('MAUTIC_USER') ?? undefined,
    password: Deno.env.get('MAUTIC_PASSWORD') ?? undefined,
    clientId: Deno.env.get('MAUTIC_CLIENT_ID') ?? undefined,
    clientSecret: Deno.env.get('MAUTIC_CLIENT_SECRET') ?? undefined,
    source: 'env',
  }
}

function getBasicAuthHeader(credentials: MauticCredentials): string | null {
  if (!credentials.user || !credentials.password) return null
  return `Basic ${btoa(`${credentials.user}:${credentials.password}`)}`
}

async function getOAuthToken(credentials: MauticCredentials): Promise<string> {
  const cacheKey = `${credentials.baseUrl}:${credentials.clientId}`
  if (cachedToken && cachedToken.key === cacheKey && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error(
      'Configure usuário e senha na integração Mautic ou MAUTIC_USER + MAUTIC_PASSWORD nos Secrets do Supabase',
    )
  }

  const res = await fetch(`${credentials.baseUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  })

  if (!res.ok) throw new Error(`Mautic OAuth falhou: ${res.status}`)
  const data = await res.json()
  cachedToken = {
    key: cacheKey,
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.token
}

async function getAuthHeader(credentials: MauticCredentials): Promise<string> {
  const basic = getBasicAuthHeader(credentials)
  if (basic) return basic
  const token = await getOAuthToken(credentials)
  return `Bearer ${token}`
}

export async function mauticFetch(path: string, options: RequestInit = {}) {
  const credentials = await getMauticCredentials()
  const authorization = await getAuthHeader(credentials)

  const res = await fetch(`${credentials.baseUrl}/api${path}`, {
    ...options,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res
}
