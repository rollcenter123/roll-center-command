import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  launchWhatsAppEmbeddedSignup,
  loadFacebookSDK,
  validateEmbeddedSignupEnv,
} from '@/lib/facebook-sdk'
import { Button } from '@/components/ui/Button'

interface WhatsAppEmbeddedSignupProps {
  onSuccess: () => void
  connected?: boolean
  wabaId?: string
  phoneNumberId?: string
  connectedAt?: string
}

export function WhatsAppEmbeddedSignup({
  onSuccess,
  connected,
  wabaId,
  phoneNumberId,
  connectedAt,
}: WhatsAppEmbeddedSignupProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [envError] = useState(() => validateEmbeddedSignupEnv())

  useEffect(() => {
    if (!envError) {
      loadFacebookSDK().catch(() => {
        // erro exibido ao clicar no botão
      })
    }
  }, [envError])

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    try {
      const { code, session } = await launchWhatsAppEmbeddedSignup()

      const { data, error: fnError } = await supabase.functions.invoke('whatsapp-embedded-signup', {
        body: {
          code,
          waba_id: session.waba_id,
          phone_number_id: session.phone_number_id,
          business_id: session.business_id,
        },
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao conectar WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-roll-gray-200 bg-roll-gray-50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
        </div>
        <div>
          <h4 className="font-medium text-roll-gray-900">Conectar via Cadastro Incorporado</h4>
          <p className="mt-1 text-sm text-roll-gray-500">
            Conecte sua conta WhatsApp Business oficial pela Meta sem precisar copiar tokens manualmente.
          </p>
        </div>
      </div>

      {connected && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">WhatsApp conectado</p>
          {wabaId && <p className="mt-1">WABA: {wabaId}</p>}
          {phoneNumberId && <p>Phone Number ID: {phoneNumberId}</p>}
          {connectedAt && (
            <p className="mt-1 text-green-700">
              Conectado em {new Date(connectedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {envError && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Configuração pendente</p>
          <p className="mt-1">{envError}</p>
          <p className="mt-2 text-xs">
            Adicione no arquivo <code className="rounded bg-amber-100 px-1">.env</code> e reinicie o servidor (<code className="rounded bg-amber-100 px-1">npm run dev</code>):
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-amber-100 p-2 text-xs">
{`VITE_FACEBOOK_APP_ID=1493808261929045
VITE_WHATSAPP_CONFIG_ID=868032692553579`}
          </pre>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <Button
        onClick={handleConnect}
        loading={loading}
        disabled={!!envError}
        className="bg-[#1877F2] hover:bg-[#166FE5] text-white disabled:opacity-50"
      >
        {connected ? 'Reconectar WhatsApp' : 'Conectar WhatsApp'}
      </Button>

      <p className="mt-3 text-xs text-roll-gray-400">
        Uma janela da Meta será aberta para você autorizar o acesso à sua conta WhatsApp Business.
      </p>
    </div>
  )
}
