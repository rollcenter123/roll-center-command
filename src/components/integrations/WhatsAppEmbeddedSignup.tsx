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
  onDisconnect?: () => void
  connected?: boolean
  wabaId?: string
  phoneNumberId?: string
  connectedAt?: string
  connectionMethod?: string
  disconnecting?: boolean
}

export function WhatsAppEmbeddedSignup({
  onSuccess,
  onDisconnect,
  connected,
  wabaId,
  phoneNumberId,
  connectedAt,
  connectionMethod,
  disconnecting,
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
          {connectionMethod && (
            <p className="mt-1 text-green-700">
              Método: {connectionMethod === 'embedded_signup' ? 'Cadastro incorporado' : 'Manual'}
            </p>
          )}
          {wabaId && <p className="mt-1">WABA: {wabaId}</p>}
          {phoneNumberId && <p>Phone Number ID: {phoneNumberId}</p>}
          {connectedAt && (
            <p className="mt-1 text-green-700">
              Conectado em {new Date(connectedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}

      <details className="mb-4 rounded-md border border-roll-gray-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium text-roll-gray-700">
          Erro ao conectar? Checklist da Meta
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-roll-gray-600">
          <li>
            <strong>Configurações do app → Básico → Domínios do app:</strong>{' '}
            <code className="rounded bg-roll-gray-100 px-1">centralrollcenter.netlify.app</code>
          </li>
          <li>
            <strong>URL do site:</strong>{' '}
            <code className="rounded bg-roll-gray-100 px-1">https://centralrollcenter.netlify.app/</code>
          </li>
          <li>
            <strong>URL da Política de Privacidade:</strong> qualquer URL HTTPS válida (ex.: a do site acima)
          </li>
          <li>
            <strong>Login do Facebook → Configurações:</strong> SDK JavaScript = Sim, domínios e URIs OAuth configurados
          </li>
          <li>Permita <strong>popups</strong> para o site no navegador</li>
        </ol>
      </details>

      {envError && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Configuração pendente</p>
          <p className="mt-1">{envError}</p>
          <p className="mt-2 text-xs">
            Em produção (Netlify): <strong>Project configuration → Environment variables</strong>, depois faça um novo deploy.
            Em desenvolvimento local: arquivo <code className="rounded bg-amber-100 px-1">.env</code> e reinicie o servidor.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleConnect}
          loading={loading}
          disabled={!!envError}
          className="bg-[#1877F2] hover:bg-[#166FE5] text-white disabled:opacity-50"
        >
          {connected ? 'Reconectar WhatsApp' : 'Conectar WhatsApp'}
        </Button>

        {(connected || wabaId || phoneNumberId) && onDisconnect && (
          <Button
            variant="outline"
            onClick={onDisconnect}
            loading={disconnecting}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            Desconectar
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs text-roll-gray-400">
        Uma janela da Meta será aberta para você autorizar o acesso à sua conta WhatsApp Business.
      </p>
    </div>
  )
}
