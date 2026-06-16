import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPhone, STATUS_LABELS } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Client, CampaignEvent, CampaignRecipient } from '@/types/database'

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Client
    },
    enabled: !!id,
  })

  const { data: recipients = [] } = useQuery({
    queryKey: ['client-recipients', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaign_recipients')
        .select('*, campaigns(name, channel)')
        .eq('client_id', id!)
      return (data ?? []) as (CampaignRecipient & { campaigns: { name: string; channel: string } })[]
    },
    enabled: !!id,
  })

  const { data: events = [] } = useQuery({
    queryKey: ['client-events', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaign_events')
        .select('*')
        .eq('client_id', id!)
        .order('occurred_at', { ascending: false })
        .limit(20)
      return (data ?? []) as CampaignEvent[]
    },
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
      </div>
    )
  }

  if (!client) return <p>Cliente não encontrado</p>

  return (
    <div>
      <Link to="/clientes" className="mb-6 inline-flex items-center gap-2 text-sm text-roll-gray-500 hover:text-roll-orange">
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-roll-gray-900">{client.name}</h1>
          <p className="text-roll-gray-500">{client.company}</p>
        </div>
        <Badge status={client.status} label={STATUS_LABELS[client.status]} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Informações">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-roll-gray-500">Email</dt><dd>{client.email ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-roll-gray-500">Telefone</dt><dd>{formatPhone(client.phone)}</dd></div>
            <div className="flex justify-between"><dt className="text-roll-gray-500">Origem</dt><dd>{client.source ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-roll-gray-500">ID de email</dt><dd>{client.mautic_contact_id ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-roll-gray-500">Cadastro</dt><dd>{formatDate(client.created_at)}</dd></div>
          </dl>
        </Card>

        <Card title="Observações">
          <p className="text-sm text-roll-gray-600">{client.notes || 'Sem observações'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Campanhas">
          {recipients.length === 0 ? (
            <p className="text-sm text-roll-gray-400">Nenhuma campanha associada</p>
          ) : (
            <div className="space-y-3">
              {recipients.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-roll-gray-100 p-3">
                  <div>
                    <p className="font-medium text-sm">{r.campaigns?.name}</p>
                    <p className="text-xs text-roll-gray-400 capitalize">{r.campaigns?.channel}</p>
                  </div>
                  <Badge status={r.status} label={STATUS_LABELS[r.status]} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Histórico de Eventos">
          {events.length === 0 ? (
            <p className="text-sm text-roll-gray-400">Nenhum evento registrado</p>
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Badge status={e.event_type} label={STATUS_LABELS[e.event_type]} />
                    {e.channel && <span className="ml-2 text-roll-gray-400 capitalize">{e.channel}</span>}
                  </div>
                  <span className="text-roll-gray-400">{formatDate(e.occurred_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
