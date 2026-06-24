import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, FieldGroup } from '@/components/ui/Input'
import { WhatsAppEmbeddedSignup } from '@/components/integrations/WhatsAppEmbeddedSignup'
import type { IntegrationSetting, WhatsAppInstance } from '@/types/database'

export function IntegrationsPage() {
  const queryClient = useQueryClient()
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, boolean>>({})

  const [mauticForm, setMauticForm] = useState({ base_url: '', client_id: '', client_secret: '' })
  const [uazapiForm, setUazapiForm] = useState({ subdomain: '', admin_token: '' })
  const [cloudForm, setCloudForm] = useState({ waba_id: '', phone_number_id: '', access_token: '', verify_token: '' })
  const [showManualCloud, setShowManualCloud] = useState(false)
  const [instanceForm, setInstanceForm] = useState({ name: '', instance_token_ref: '', phone_number: '' })

  const { data: settings = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data } = await supabase.from('integration_settings').select('*')
      return (data ?? []) as IntegrationSetting[]
    },
  })

  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const { data } = await supabase.from('whatsapp_instances').select('*')
      return (data ?? []) as WhatsAppInstance[]
    },
  })

  const saveIntegration = useMutation({
    mutationFn: async ({ provider, config }: { provider: string; config: Record<string, unknown> }) => {
      const { error } = await supabase.from('integration_settings').upsert(
        { provider, config, is_active: true },
        { onConflict: 'provider' }
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  })

  const saveInstance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('whatsapp_instances').insert({
        name: instanceForm.name,
        instance_token_ref: instanceForm.instance_token_ref,
        phone_number: instanceForm.phone_number || null,
        status: 'disconnected',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] })
      setInstanceForm({ name: '', instance_token_ref: '', phone_number: '' })
    },
  })

  const testConnection = async (provider: string) => {
    setTesting(provider)
    try {
      const fnMap: Record<string, string> = {
        mautic: 'mautic-list-campaigns',
        uazapi: 'whatsapp-send-uazapi',
        whatsapp_cloud: 'whatsapp-send-cloud',
      }
      const { error } = await supabase.functions.invoke(fnMap[provider] ?? 'mautic-list-campaigns', {
        body: { test: true },
      })
      setTestResult((prev) => ({ ...prev, [provider]: !error }))
    } catch {
      setTestResult((prev) => ({ ...prev, [provider]: false }))
    }
    setTesting(null)
  }

  const isActive = (provider: string) => settings.find((s) => s.provider === provider)?.is_active

  const cloudSetting = settings.find((s) => s.provider === 'whatsapp_cloud')
  const cloudConfig = cloudSetting?.config as Record<string, string> | undefined

  useEffect(() => {
    if (cloudConfig) {
      setCloudForm((prev) => ({
        ...prev,
        waba_id: cloudConfig.waba_id ?? prev.waba_id,
        phone_number_id: cloudConfig.phone_number_id ?? prev.phone_number_id,
      }))
    }
  }, [cloudConfig?.waba_id, cloudConfig?.phone_number_id])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-roll-gray-900">Integrações</h1>
        <p className="text-roll-gray-500">Configure conexões de email, WhatsApp e integrações</p>
      </div>

      <div className="space-y-6">
        <Card title="Email (Campanhas)">
          <div className="mb-4 flex items-center gap-2">
            {isActive('mautic') ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-roll-gray-400" />
            )}
            <span className="text-sm text-roll-gray-500">
              {isActive('mautic') ? 'Configurado' : 'Não configurado'}
            </span>
            {testResult.mautic !== undefined && (
              <span className={`text-sm ${testResult.mautic ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.mautic ? 'Conexão OK' : 'Falha na conexão'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FieldGroup label="URL Base">
              <Input
                value={mauticForm.base_url}
                onChange={(e) => setMauticForm({ ...mauticForm, base_url: e.target.value })}
                placeholder="https://mautic.seudominio.com"
              />
            </FieldGroup>
            <FieldGroup label="Client ID">
              <Input value={mauticForm.client_id} onChange={(e) => setMauticForm({ ...mauticForm, client_id: e.target.value })} />
            </FieldGroup>
            <FieldGroup label="Client Secret">
              <Input type="password" value={mauticForm.client_secret} onChange={(e) => setMauticForm({ ...mauticForm, client_secret: e.target.value })} />
            </FieldGroup>
          </div>
          <p className="mt-2 text-xs text-roll-gray-400">
            Credenciais sensíveis devem ser configuradas como Secrets no Supabase (MAUTIC_CLIENT_ID, MAUTIC_CLIENT_SECRET, MAUTIC_BASE_URL).
          </p>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => saveIntegration.mutate({ provider: 'mautic', config: { base_url: mauticForm.base_url } })}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => testConnection('mautic')} loading={testing === 'mautic'}>
              Testar Conexão
            </Button>
          </div>
        </Card>

        <Card title="UAZAPI (WhatsApp)">
          <div className="mb-4 flex items-center gap-2">
            {isActive('uazapi') ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-roll-gray-400" />
            )}
            <span className="text-sm text-roll-gray-500">
              {isActive('uazapi') ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldGroup label="Subdomínio">
              <Input
                value={uazapiForm.subdomain}
                onChange={(e) => setUazapiForm({ ...uazapiForm, subdomain: e.target.value })}
                placeholder="sua-instancia"
              />
            </FieldGroup>
            <FieldGroup label="Admin Token">
              <Input type="password" value={uazapiForm.admin_token} onChange={(e) => setUazapiForm({ ...uazapiForm, admin_token: e.target.value })} />
            </FieldGroup>
          </div>
          <p className="mt-2 text-xs text-roll-gray-400">
            Secrets: UAZAPI_SUBDOMAIN, UAZAPI_ADMIN_TOKEN
          </p>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => saveIntegration.mutate({ provider: 'uazapi', config: { subdomain: uazapiForm.subdomain } })}>
              Salvar
            </Button>
          </div>

          <div className="mt-6 border-t border-roll-gray-100 pt-6">
            <h4 className="mb-4 font-medium">Instâncias UAZAPI</h4>
            {instances.map((inst) => (
              <div key={inst.id} className="mb-2 flex items-center justify-between rounded-lg bg-roll-gray-50 p-3 text-sm">
                <span>{inst.name} — {inst.phone_number ?? 'sem número'}</span>
                <span className="capitalize text-roll-gray-400">{inst.status}</span>
              </div>
            ))}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <FieldGroup label="Nome da Instância">
                <Input value={instanceForm.name} onChange={(e) => setInstanceForm({ ...instanceForm, name: e.target.value })} />
              </FieldGroup>
              <FieldGroup label="Token da Instância (ref)">
                <Input value={instanceForm.instance_token_ref} onChange={(e) => setInstanceForm({ ...instanceForm, instance_token_ref: e.target.value })} placeholder="UAZAPI_INSTANCE_TOKEN_1" />
              </FieldGroup>
              <FieldGroup label="Telefone">
                <Input value={instanceForm.phone_number} onChange={(e) => setInstanceForm({ ...instanceForm, phone_number: e.target.value })} />
              </FieldGroup>
            </div>
            <Button className="mt-4" onClick={() => saveInstance.mutate()} loading={saveInstance.isPending}>
              Adicionar Instância
            </Button>
          </div>
        </Card>

        <Card title="WhatsApp Cloud API (Meta)">
          <div className="mb-4 flex items-center gap-2">
            {isActive('whatsapp_cloud') ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-roll-gray-400" />
            )}
            <span className="text-sm text-roll-gray-500">
              {isActive('whatsapp_cloud') ? 'Configurado' : 'Não configurado'}
            </span>
            {testResult.whatsapp_cloud !== undefined && (
              <span className={`text-sm ${testResult.whatsapp_cloud ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.whatsapp_cloud ? 'Conexão OK' : 'Falha na conexão'}
              </span>
            )}
          </div>

          <WhatsAppEmbeddedSignup
            connected={isActive('whatsapp_cloud')}
            wabaId={cloudConfig?.waba_id}
            phoneNumberId={cloudConfig?.phone_number_id}
            connectedAt={cloudConfig?.connected_at}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['integrations'] })}
          />

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowManualCloud(!showManualCloud)}
              className="flex items-center gap-1 text-sm text-roll-gray-500 hover:text-roll-gray-700"
            >
              {showManualCloud ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Configuração manual (avançado)
            </button>

            {showManualCloud && (
              <div className="mt-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldGroup label="WABA ID">
                    <Input value={cloudForm.waba_id} onChange={(e) => setCloudForm({ ...cloudForm, waba_id: e.target.value })} />
                  </FieldGroup>
                  <FieldGroup label="Phone Number ID">
                    <Input value={cloudForm.phone_number_id} onChange={(e) => setCloudForm({ ...cloudForm, phone_number_id: e.target.value })} />
                  </FieldGroup>
                  <FieldGroup label="Access Token">
                    <Input type="password" value={cloudForm.access_token} onChange={(e) => setCloudForm({ ...cloudForm, access_token: e.target.value })} />
                  </FieldGroup>
                  <FieldGroup label="Verify Token (Webhook)">
                    <Input value={cloudForm.verify_token} onChange={(e) => setCloudForm({ ...cloudForm, verify_token: e.target.value })} />
                  </FieldGroup>
                </div>
                <p className="mt-2 text-xs text-roll-gray-400">
                  Secrets alternativos: WHATSAPP_CLOUD_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN.
                  Para cadastro incorporado, configure FACEBOOK_APP_SECRET nos Secrets do Supabase.
                </p>
                <div className="mt-4 flex gap-3">
                  <Button onClick={() => saveIntegration.mutate({
                    provider: 'whatsapp_cloud',
                    config: {
                      waba_id: cloudForm.waba_id,
                      phone_number_id: cloudForm.phone_number_id,
                      ...(cloudForm.access_token ? { access_token: cloudForm.access_token } : {}),
                      connection_method: 'manual',
                    },
                  })}>
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => testConnection('whatsapp_cloud')} loading={testing === 'whatsapp_cloud'}>
                    Testar Conexão
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!showManualCloud && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => testConnection('whatsapp_cloud')} loading={testing === 'whatsapp_cloud'}>
                Testar Conexão
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
