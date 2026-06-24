const SDK_URL = 'https://connect.facebook.net/pt_BR/sdk.js'
const GRAPH_API_VERSION = 'v21.0'
const SDK_LOAD_TIMEOUT_MS = 15_000

let sdkLoadPromise: Promise<void> | null = null

export interface EmbeddedSignupSession {
  waba_id?: string
  phone_number_id?: string
  business_id?: string
  event?: string
}

declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void
      login: (
        callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
        options: Record<string, unknown>,
      ) => void
    }
    fbAsyncInit?: () => void
  }
}

const DEFAULT_FACEBOOK_APP_ID = '1493808261929045'
const DEFAULT_WHATSAPP_CONFIG_ID = '868032692553579'

export function getFacebookAppId(): string | undefined {
  return import.meta.env.VITE_FACEBOOK_APP_ID || DEFAULT_FACEBOOK_APP_ID
}

export function getWhatsAppConfigId(): string | undefined {
  return import.meta.env.VITE_WHATSAPP_CONFIG_ID || DEFAULT_WHATSAPP_CONFIG_ID
}

export function validateEmbeddedSignupEnv(): string | null {
  if (!import.meta.env.VITE_FACEBOOK_APP_ID && !DEFAULT_FACEBOOK_APP_ID) {
    return 'VITE_FACEBOOK_APP_ID não configurado'
  }
  if (!import.meta.env.VITE_WHATSAPP_CONFIG_ID && !DEFAULT_WHATSAPP_CONFIG_ID) {
    return 'VITE_WHATSAPP_CONFIG_ID não configurado'
  }
  return null
}

function requireAppId(): string {
  const appId = getFacebookAppId()
  if (!appId) throw new Error('VITE_FACEBOOK_APP_ID não configurado no .env')
  return appId
}

function requireConfigId(): string {
  const configId = getWhatsAppConfigId()
  if (!configId) throw new Error('VITE_WHATSAPP_CONFIG_ID não configurado no .env')
  return configId
}

export function loadFacebookSDK(): Promise<void> {
  if (window.FB) return Promise.resolve()
  if (sdkLoadPromise) return sdkLoadPromise

  requireAppId()

  sdkLoadPromise = new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      clearInterval(pollId)
      fn()
    }

    const timeoutId = window.setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            'Timeout ao carregar Facebook SDK. Verifique sua conexão e se localhost está nos domínios do app Meta.',
          ),
        ),
      )
    }, SDK_LOAD_TIMEOUT_MS)

    const pollId = window.setInterval(() => {
      if (window.FB) {
        finish(resolve)
      }
    }, 100)

    window.fbAsyncInit = () => {
      try {
        window.FB!.init({
          appId: requireAppId(),
          cookie: true,
          autoLogAppEvents: true,
          xfbml: true,
          version: GRAPH_API_VERSION,
        })
        finish(resolve)
      } catch (e) {
        finish(() =>
          reject(e instanceof Error ? e : new Error('Erro ao inicializar Facebook SDK')),
        )
      }
    }

    const existing = document.getElementById('facebook-jssdk')
    if (!existing) {
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.src = SDK_URL
      script.async = true
      script.defer = true
      script.onerror = () =>
        finish(() => reject(new Error('Falha ao carregar Facebook SDK (bloqueio de rede ou CSP)')))
      document.body.appendChild(script)
    }
  })

  return sdkLoadPromise
}

export function listenEmbeddedSignup(
  onSession: (session: EmbeddedSignupSession) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    if (!event.origin.endsWith('facebook.com')) return
    try {
      const data = JSON.parse(event.data as string) as {
        type?: string
        event?: string
        data?: EmbeddedSignupSession
      }
      if (data.type !== 'WA_EMBEDDED_SIGNUP') return

      const finishEvents = [
        'FINISH',
        'FINISH_ONLY_WABA',
        'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
      ]
      if (finishEvents.includes(data.event ?? '') && data.data) {
        onSession({ ...data.data, event: data.event })
      }
    } catch {
      // ignore non-JSON messages
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

export async function launchWhatsAppEmbeddedSignup(): Promise<{
  code: string
  session: EmbeddedSignupSession
}> {
  const envError = validateEmbeddedSignupEnv()
  if (envError) throw new Error(envError)

  await loadFacebookSDK()

  if (!window.FB) {
    throw new Error('Facebook SDK não disponível após carregamento')
  }

  const fb = window.FB

  return new Promise((resolve, reject) => {
    let session: EmbeddedSignupSession = {}
    const removeListener = listenEmbeddedSignup((s) => {
      session = { ...session, ...s }
    })

    const timeout = window.setTimeout(() => {
      removeListener()
      reject(new Error('Tempo esgotado aguardando autorização. Tente novamente.'))
    }, 5 * 60 * 1000)

    try {
      fb.login(
        (response) => {
          window.clearTimeout(timeout)
          removeListener()

          if (response.authResponse?.code) {
            resolve({ code: response.authResponse.code, session })
            return
          }

          const status = response.status ?? 'unknown'
          reject(
            new Error(
              status === 'unknown'
                ? 'Popup bloqueado ou não abriu. Permita popups para localhost e tente novamente.'
                : 'Conexão cancelada ou não autorizada.',
            ),
          )
        },
        {
          config_id: requireConfigId(),
          auth_type: 'rerequest',
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            featureType: 'whatsapp_business_app_onboarding',
            sessionInfoVersion: 3,
            version: 'v4',
            setup: {},
          },
        },
      )
    } catch (e) {
      window.clearTimeout(timeout)
      removeListener()
      reject(e instanceof Error ? e : new Error('Erro ao abrir cadastro Meta'))
    }
  })
}
