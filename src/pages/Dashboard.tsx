import { useQuery } from '@tanstack/react-query'
import { Users, Mail, MessageCircle, TrendingUp, Eye } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { buildDayRows, fetchEmailsMautic, sumMetrics } from '@/lib/emails-mautic'
import { CHART_COLOR_READ, CHART_COLOR_SENT } from '@/lib/chart-colors'
import { formatNumber, formatPercent, calculateOpenRate, formatDateOnly } from '@/lib/utils'
import { StatCard, Card } from '@/components/ui/Card'
import { CampaignReportSwitcher } from '@/components/reports/CampaignReportSwitcher'
import { EmailOpenRateRanking } from '@/components/reports/EmailOpenRateRanking'
import type { Client, Campaign, CampaignRecipient } from '@/types/database'

const COLORS = ['#f97316', '#6b7280', '#22c55e', '#3b82f6', '#a855f7']

async function fetchDashboardData() {
  const [clientsRes, campaignsRes, recipientsRes, emailsRes] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('campaigns').select('*'),
    supabase.from('campaign_recipients').select('*'),
    fetchEmailsMautic(),
  ])

  return {
    clients: (clientsRes.data ?? []) as Client[],
    campaigns: (campaignsRes.data ?? []) as Campaign[],
    recipients: (recipientsRes.data ?? []) as CampaignRecipient[],
    emails: emailsRes,
  }
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardData })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
      </div>
    )
  }

  const clients = data?.clients ?? []
  const campaigns = data?.campaigns ?? []
  const recipients = data?.recipients ?? []
  const emails = data?.emails ?? []
  const dayRows = buildDayRows(emails)
  const emailTotals = sumMetrics(dayRows)

  const emailOpenRate = calculateOpenRate(emailTotals.abertos, emailTotals.enviados)

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const newClientsWeek = clients.filter((c) => new Date(c.created_at) >= weekAgo).length
  const newClientsMonth = clients.filter((c) => new Date(c.created_at) >= monthAgo).length

  const waRecipients = recipients.filter((r) =>
    campaigns.find((c) => c.id === r.campaign_id)?.channel === 'whatsapp'
  )

  const countByStatus = (list: CampaignRecipient[], status: string) =>
    list.filter((r) => r.status === status).length

  const waSent = waRecipients.filter((r) => r.status !== 'pending' && r.status !== 'failed').length
  const waRead = countByStatus(waRecipients, 'read') + countByStatus(waRecipients, 'replied')
  const waReplied = countByStatus(waRecipients, 'replied')

  const statusCounts = [
    { name: 'Lead', value: clients.filter((c) => c.status === 'lead').length },
    { name: 'Contatado', value: clients.filter((c) => c.status === 'contacted').length },
    { name: 'Convertido', value: clients.filter((c) => c.status === 'converted').length },
    { name: 'Inativo', value: clients.filter((c) => c.status === 'inactive').length },
  ]

  const funnelData = [
    { name: 'Leads', value: clients.filter((c) => c.status === 'lead').length, fill: '#f97316' },
    { name: 'Contatados', value: clients.filter((c) => c.status === 'contacted').length, fill: '#fb923c' },
    { name: 'Convertidos', value: clients.filter((c) => c.status === 'converted').length, fill: '#22c55e' },
  ]

  const emailTimeline = dayRows.map((row) => ({
    date: formatDateOnly(row.dateKey),
    enviados: row.enviados ?? 0,
    abertos: row.abertos ?? 0,
    taxa: calculateOpenRate(row.abertos ?? 0, row.enviados ?? 0),
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-roll-gray-900">Dashboard</h1>
        <p className="text-roll-gray-500">Visão geral da Central de Comando Roll Center</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de Clientes" value={formatNumber(clients.length)} subtext={`+${newClientsWeek} esta semana`} icon={<Users className="h-6 w-6" />} />
        <StatCard label="Campanhas Ativas" value={formatNumber(campaigns.filter((c) => c.status === 'running').length)} subtext={`${campaigns.length} no total`} icon={<TrendingUp className="h-6 w-6" />} color="green" />
        <StatCard label="Emails Enviados" value={formatNumber(emailTotals.enviados)} subtext={`${dayRows.length} disparos de email`} icon={<Mail className="h-6 w-6" />} />
        <StatCard label="WhatsApp Enviados" value={formatNumber(waSent)} subtext={`Respostas: ${formatPercent(waReplied, waSent)}`} icon={<MessageCircle className="h-6 w-6" />} color="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard label="Novos (30 dias)" value={formatNumber(newClientsMonth)} icon={<Users className="h-6 w-6" />} color="blue" />
        <StatCard label="Taxa de Abertura (Email)" value={`${emailOpenRate}%`} subtext={`${formatNumber(emailTotals.abertos)} aberturas`} icon={<Eye className="h-6 w-6" />} color="gray" />
        <StatCard label="Taxa de Leitura (WA)" value={formatPercent(waRead, waSent)} icon={<Eye className="h-6 w-6" />} color="gray" />
      </div>

      <CampaignReportSwitcher showSyncButton />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Email — Engajamento por Dia">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={emailTimeline.length > 0 ? emailTimeline : [{ date: '—', enviados: 0, abertos: 0, taxa: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="enviados" fill={CHART_COLOR_SENT} name="Enviados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="abertos" fill={CHART_COLOR_READ} name="Aberturas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Clientes por Status">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusCounts} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {statusCounts.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Funil de Conversão">
          <ResponsiveContainer width="100%" height={300}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" fill="#374151" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </Card>

        <div className="min-w-0">
          <EmailOpenRateRanking dayRows={dayRows} />
        </div>
      </div>

      <Card title="Disparos de Email">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-roll-gray-200 text-left text-roll-gray-500">
                <th className="pb-3 font-medium">Dia</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Data</th>
                <th className="pb-3 font-medium">Enviados</th>
                <th className="pb-3 font-medium">Aberturas</th>
                <th className="pb-3 font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {[...dayRows].reverse().map((row) => (
                <tr key={row.id} className="border-b border-roll-gray-100">
                  <td className="py-3">{row.dayNumber}</td>
                  <td className="py-3 font-medium">{row.nome}</td>
                  <td className="py-3">{formatDateOnly(row.dateKey)}</td>
                  <td className="py-3">{formatNumber(row.enviados ?? 0)}</td>
                  <td className="py-3">{formatNumber(row.abertos ?? 0)}</td>
                  <td className="py-3 text-roll-orange">
                    {calculateOpenRate(row.abertos ?? 0, row.enviados ?? 0)}%
                  </td>
                </tr>
              ))}
              {dayRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-roll-gray-400">
                    Nenhum disparo sincronizado. Use &quot;Atualizar Emails&quot; acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
