import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { STATUS_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, FieldGroup, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import type { Campaign, Client, WhatsAppInstance, WhatsAppProvider } from '@/types/database'

async function fetchWhatsAppCampaigns() {
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('channel', 'whatsapp')
    .order('created_at', { ascending: false })
  return (data ?? []) as Campaign[]
}

export function WhatsAppCampaignsPage() {
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', whatsapp_provider: 'uazapi' as WhatsAppProvider,
    message_template: '', instance_id: '', cloud_template_name: '',
  })

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['whatsapp-campaigns'],
    queryFn: fetchWhatsAppCampaigns,
  })

  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const { data } = await supabase.from('whatsapp_instances').select('*')
      return (data ?? []) as WhatsAppInstance[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('campaigns').insert({
        name: form.name,
        description: form.description || null,
        channel: 'whatsapp',
        whatsapp_provider: form.whatsapp_provider,
        message_template: form.message_template,
        status: 'draft',
        created_by: user?.id,
        metadata: {
          instance_id: form.instance_id || null,
          cloud_template_name: form.cloud_template_name || null,
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] })
      setModalOpen(false)
    },
  })

  const launchMutation = useMutation({
    mutationFn: async (campaign: Campaign) => {
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('whatsapp_opt_in', true)
        .not('phone', 'is', null)

      const clientList = (clients ?? []) as Client[]

      const recipients = clientList.map((c) => ({
        campaign_id: campaign.id,
        client_id: c.id,
        status: 'pending' as const,
      }))

      if (recipients.length > 0) {
        await supabase.from('campaign_recipients').upsert(recipients, { onConflict: 'campaign_id,client_id' })
      }

      const fnName = campaign.whatsapp_provider === 'cloud_api'
        ? 'whatsapp-send-cloud'
        : 'whatsapp-send-uazapi'

      const { error } = await supabase.functions.invoke(fnName, {
        body: { campaign_id: campaign.id },
      })
      if (error) throw error

      await supabase.from('campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', campaign.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] }),
  })

  const canEdit = hasPermission('campaigns_edit')

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-roll-gray-900">Campanhas de WhatsApp</h1>
          <p className="text-roll-gray-500">UAZAPI e WhatsApp Cloud API</p>
        </div>
        {canEdit && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Campanha
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-roll-gray-100 p-4">
                <div>
                  <h3 className="font-medium">{c.name}</h3>
                  <p className="text-sm text-roll-gray-400">{c.description}</p>
                  <p className="text-xs text-roll-gray-400 capitalize">
                    Provedor: {c.whatsapp_provider === 'cloud_api' ? 'Cloud API' : 'UAZAPI'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={c.status} label={STATUS_LABELS[c.status]} />
                  {canEdit && c.status === 'draft' && (
                    <Button size="sm" onClick={() => launchMutation.mutate(c)} loading={launchMutation.isPending}>
                      <Play className="h-3 w-3" /> Disparar
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <p className="py-8 text-center text-roll-gray-400">Nenhuma campanha de WhatsApp criada</p>
            )}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Campanha de WhatsApp" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}>
          <FieldGroup label="Nome *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </FieldGroup>
          <FieldGroup label="Descrição">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Provedor">
            <Select
              value={form.whatsapp_provider}
              onChange={(e) => setForm({ ...form, whatsapp_provider: e.target.value as WhatsAppProvider })}
            >
              <option value="uazapi">UAZAPI</option>
              <option value="cloud_api">WhatsApp Cloud API</option>
            </Select>
          </FieldGroup>

          {form.whatsapp_provider === 'uazapi' && (
            <FieldGroup label="Instância UAZAPI">
              <Select value={form.instance_id} onChange={(e) => setForm({ ...form, instance_id: e.target.value })}>
                <option value="">Selecione...</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name} ({inst.phone_number ?? inst.status})</option>
                ))}
              </Select>
            </FieldGroup>
          )}

          {form.whatsapp_provider === 'cloud_api' && (
            <FieldGroup label="Nome do Template (Meta)">
              <Input
                value={form.cloud_template_name}
                onChange={(e) => setForm({ ...form, cloud_template_name: e.target.value })}
                placeholder="nome_do_template"
              />
            </FieldGroup>
          )}

          <FieldGroup label="Mensagem">
            <Textarea
              value={form.message_template}
              onChange={(e) => setForm({ ...form, message_template: e.target.value })}
              placeholder="Olá {{nome}}! Mensagem da Roll Center para {{empresa}}."
              rows={4}
              required
            />
          </FieldGroup>
          <p className="mb-4 text-xs text-roll-gray-400">
            Variáveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{email}}'}, {'{{telefone}}'}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={createMutation.isPending}>Criar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
