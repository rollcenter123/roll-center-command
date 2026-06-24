import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { buildDayRows, fetchEmailsMautic } from '@/lib/emails-mautic'
import { CHART_COLOR_READ, CHART_COLOR_SENT } from '@/lib/chart-colors'
import { formatNumber, calculateOpenRate, formatDateOnly } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { CampaignReportSwitcher } from '@/components/reports/CampaignReportSwitcher'
import { EmailOpenRateRanking } from '@/components/reports/EmailOpenRateRanking'
import type { Client } from '@/types/database'

const COLORS = ['#f97316', '#6b7280', '#22c55e', '#3b82f6', '#a855f7']

async function fetchDashboardData() {
  const [clientsRes, emailsRes] = await Promise.all([
    supabase.from('clients').select('*'),
    fetchEmailsMautic(),
  ])

  return {
    clients: (clientsRes.data ?? []) as Client[],
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
  const emails = data?.emails ?? []
  const dayRows = buildDayRows(emails)

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
        <p className="text-roll-gray-500">Visão Geral / Métricas</p>
      </div>

      <CampaignReportSwitcher showSyncButton showCrmKanban />

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
                    Nenhum disparo sincronizado. Use &quot;Atualizar&quot; acima.
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
