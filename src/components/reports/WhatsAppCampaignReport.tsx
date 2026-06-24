import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Eye, MessageCircle, Percent, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROLL_CENTER_LOGO_URL } from '@/lib/branding'
import { CHART_COLOR_READ, CHART_COLOR_SENT } from '@/lib/chart-colors'
import {
  calculateOpenRate,
  formatDateOnly,
  formatDateKey,
  formatNumber,
  getYesterday,
  toDateInputValue,
} from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { EngagementDonutChart } from '@/components/reports/EngagementDonutChart'
import { WhatsAppCrmKanban } from '@/components/reports/WhatsAppCrmKanban'
import type { CampaignReportType } from '@/components/reports/CampaignTypeSelector'
import type { Campaign, CampaignRecipient } from '@/types/database'

function HighlightCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-roll-gray-200 bg-white px-6 py-5 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-roll-orange">
        {icon}
      </div>
      <p className="text-4xl font-bold text-roll-orange">{value}</p>
      <p className="mt-1 text-sm font-medium text-roll-gray-700">{label}</p>
    </div>
  )
}

async function fetchWhatsAppReportData() {
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('channel', 'whatsapp')
    .order('created_at', { ascending: true })

  if (campaignsError) throw campaignsError

  const campaignList = (campaigns ?? []) as Campaign[]
  const campaignIds = campaignList.map((campaign) => campaign.id)

  if (campaignIds.length === 0) {
    return { campaigns: campaignList, recipients: [] as CampaignRecipient[] }
  }

  const { data: recipients, error: recipientsError } = await supabase
    .from('campaign_recipients')
    .select('*')
    .in('campaign_id', campaignIds)

  if (recipientsError) throw recipientsError

  return {
    campaigns: campaignList,
    recipients: (recipients ?? []) as CampaignRecipient[],
  }
}

function toLocalDateKey(value: string | null): string | null {
  if (!value) return null
  return toDateInputValue(new Date(value))
}

interface WhatsAppCampaignReportProps {
  showPageHeader?: boolean
  showSyncButton?: boolean
  showCrmKanban?: boolean
  campaignSelector?: React.ReactNode
  campaignType?: CampaignReportType
  onCampaignTypeChange?: (type: CampaignReportType) => void
}

export function WhatsAppCampaignReport({
  showPageHeader = false,
  showSyncButton = true,
  showCrmKanban = false,
  campaignSelector,
}: WhatsAppCampaignReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [dailyDate, setDailyDate] = useState(() => toDateInputValue(getYesterday()))
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['whatsapp-campaign-report'],
    queryFn: fetchWhatsAppReportData,
    refetchInterval: 60_000,
  })

  const recipients = data?.recipients ?? []
  const campaigns = data?.campaigns ?? []

  const allDayRows = useMemo(() => {
    const byDate = new Map<string, CampaignRecipient[]>()

    recipients.forEach((recipient) => {
      const dateKey = toLocalDateKey(recipient.sent_at ?? recipient.created_at)
      if (!dateKey) return
      const list = byDate.get(dateKey) ?? []
      list.push(recipient)
      byDate.set(dateKey, list)
    })

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, dayRecipients], index) => {
        const enviados = dayRecipients.filter(
          (r) => r.status !== 'pending' && r.status !== 'failed',
        ).length
        const lidos = dayRecipients.filter((r) =>
          ['read', 'replied'].includes(r.status),
        ).length

        return {
          id: dateKey,
          dateKey,
          dayNumber: index + 1,
          enviados,
          lidos,
        }
      })
  }, [recipients])

  useEffect(() => {
    if (allDayRows.length === 0) return

    const first = allDayRows[0].dateKey
    const last = allDayRows[allDayRows.length - 1].dateKey

    setRangeStart((current) => current || first)
    setRangeEnd((current) => current || last)

    const availableDates = new Set(allDayRows.map((row) => row.dateKey))
    setDailyDate((current) => (availableDates.has(current) ? current : last))
  }, [allDayRows])

  const periodRows = useMemo(() => {
    if (!rangeStart || !rangeEnd) return allDayRows
    return allDayRows.filter((row) => row.dateKey >= rangeStart && row.dateKey <= rangeEnd)
  }, [allDayRows, rangeStart, rangeEnd])

  const periodTotals = useMemo(
    () =>
      periodRows.reduce(
        (acc, row) => ({
          enviados: acc.enviados + row.enviados,
          lidos: acc.lidos + row.lidos,
        }),
        { enviados: 0, lidos: 0 },
      ),
    [periodRows],
  )

  const readRate = calculateOpenRate(periodTotals.lidos, periodTotals.enviados)

  const dailyRows = useMemo(
    () => allDayRows.filter((row) => row.dateKey === dailyDate),
    [allDayRows, dailyDate],
  )

  const dailyTotals = useMemo(
    () =>
      dailyRows.reduce(
        (acc, row) => ({
          enviados: acc.enviados + row.enviados,
          lidos: acc.lidos + row.lidos,
        }),
        { enviados: 0, lidos: 0 },
      ),
    [dailyRows],
  )

  const dailyHighlight = dailyRows[0]

  const dailyChartData = useMemo(
    () => [
      { metric: 'Enviados', valor: dailyTotals.enviados, fill: CHART_COLOR_SENT },
      { metric: 'Lidos', valor: dailyTotals.lidos, fill: CHART_COLOR_READ },
    ],
    [dailyTotals],
  )

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        Não foi possível carregar os dados da campanha. Verifique a conexão com o Supabase.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {(showPageHeader || showSyncButton || campaignSelector) && (
        <div className="flex flex-col gap-4">
          {showPageHeader && (
            <div>
              <h1 className="text-2xl font-bold text-roll-gray-900">Métricas</h1>
              <p className="text-roll-gray-500">Relatório da campanha de WhatsApp</p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {campaignSelector}
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              {showSyncButton && (
                <Button variant="outline" disabled title="Em breve">
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              )}
              <Button disabled title="Em breve">
                <Download className="h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCrmKanban && (
        <div className="rounded-xl border border-roll-gray-200 bg-white p-6 shadow-sm">
          <WhatsAppCrmKanban />
        </div>
      )}

      {allDayRows.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nenhum disparo de WhatsApp encontrado no período.
        </div>
      )}

      {dataUpdatedAt > 0 && (
        <p className="text-xs text-roll-gray-400">
          Última atualização: {formatDateOnly(new Date(dataUpdatedAt))} às{' '}
          {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <div
        ref={reportRef}
        className="overflow-hidden rounded-2xl border border-roll-gray-200 bg-roll-gray-100 shadow-sm"
      >
        <div className="bg-roll-orange px-6 py-8 text-white sm:px-8">
          <div className="flex items-center gap-4">
            <img
              src={ROLL_CENTER_LOGO_URL}
              alt="Roll Center"
              className="h-14 w-14 rounded-xl bg-white object-contain p-1"
              crossOrigin="anonymous"
            />
            <div>
              <p className="text-sm font-medium text-orange-100">Grupo Roll Center</p>
              <h2 className="text-2xl font-bold sm:text-3xl">Campanha de WhatsApp</h2>
              {rangeStart && rangeEnd && (
                <p className="mt-1 text-sm text-white">
                  {formatDateKey(rangeStart)} — {formatDateKey(rangeEnd)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <HighlightCard
              label="mensagens enviadas"
              value={formatNumber(periodTotals.enviados)}
              icon={<MessageCircle className="h-5 w-5" />}
            />
            <HighlightCard
              label="lidos"
              value={formatNumber(periodTotals.lidos)}
              icon={<Eye className="h-5 w-5" />}
            />
            <HighlightCard
              label="taxa média de leitura"
              value={`${readRate}%`}
              icon={<Percent className="h-5 w-5" />}
            />
          </div>

          <section className="rounded-2xl border border-roll-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-roll-gray-900">Visão diária</h3>
                <p className="text-sm text-roll-gray-500">Métricas de um único dia de disparo</p>
              </div>
              <div className="w-full max-w-xs">
                <Label htmlFor="wa-daily-date">Data do disparo</Label>
                <Input
                  id="wa-daily-date"
                  type="date"
                  value={dailyDate}
                  data-export-date={formatDateKey(dailyDate)}
                  min={allDayRows[0]?.dateKey}
                  max={allDayRows[allDayRows.length - 1]?.dateKey}
                  onChange={(event) => setDailyDate(event.target.value)}
                />
              </div>
            </div>

            {dailyHighlight ? (
              <div className="mb-6 rounded-xl bg-orange-50 px-4 py-3 text-sm text-roll-gray-700">
                <span className="font-semibold text-roll-orange">
                  Destaque do dia ({formatDateKey(dailyDate)})
                </span>
                {' · '}
                Dia {dailyHighlight.dayNumber}
                {' · '}
                {formatNumber(dailyTotals.enviados)} mensagens enviadas
                {' · '}
                {formatNumber(dailyTotals.lidos)} lidos
              </div>
            ) : (
              <div className="mb-6 rounded-xl bg-roll-gray-50 px-4 py-3 text-sm text-roll-gray-500">
                Nenhum disparo registrado para {formatDateKey(dailyDate)}.
              </div>
            )}

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyChartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(value) => [formatNumber(Number(value ?? 0)), 'Quantidade']} />
                <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                  {dailyChartData.map((entry) => (
                    <Cell key={entry.metric} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-2xl border border-roll-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-roll-gray-900">Visão total e comparativo</h3>
                <p className="text-sm text-roll-gray-500">Acumulado do período com detalhe por dia</p>
              </div>
              <div className="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="wa-range-start">Data inicial</Label>
                  <Input
                    id="wa-range-start"
                    type="date"
                    value={rangeStart}
                    data-export-date={formatDateKey(rangeStart)}
                    min={allDayRows[0]?.dateKey}
                    max={rangeEnd || allDayRows[allDayRows.length - 1]?.dateKey}
                    onChange={(event) => setRangeStart(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="wa-range-end">Data final</Label>
                  <Input
                    id="wa-range-end"
                    type="date"
                    value={rangeEnd}
                    data-export-date={formatDateKey(rangeEnd)}
                    min={rangeStart || allDayRows[0]?.dateKey}
                    max={allDayRows[allDayRows.length - 1]?.dateKey}
                    onChange={(event) => setRangeEnd(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-roll-gray-200 text-left text-roll-gray-500">
                    <th className="pb-3 pr-4 font-semibold">Dia</th>
                    <th className="pb-3 pr-4 font-semibold">Data</th>
                    <th className="pb-3 pr-4 font-semibold">Enviados</th>
                    <th className="pb-3 pr-4 font-semibold">Lidos</th>
                    <th className="pb-3 font-semibold">% Leitura</th>
                  </tr>
                </thead>
                <tbody>
                  {[...periodRows].reverse().map((row) => (
                    <tr key={row.id} className="border-b border-roll-gray-100">
                      <td className="py-3 pr-4 font-medium text-roll-gray-900">{row.dayNumber}</td>
                      <td className="py-3 pr-4 text-roll-gray-900">{formatDateKey(row.dateKey)}</td>
                      <td className="py-3 pr-4 text-roll-gray-500">{formatNumber(row.enviados)}</td>
                      <td className="py-3 pr-4 font-medium text-roll-orange">{formatNumber(row.lidos)}</td>
                      <td className="py-3 font-medium text-roll-orange">
                        {calculateOpenRate(row.lidos, row.enviados)}%
                      </td>
                    </tr>
                  ))}
                  {periodRows.length > 0 && (
                    <tr className="bg-roll-gray-50 font-semibold text-roll-gray-900">
                      <td className="py-3 pr-4">TOTAL</td>
                      <td className="py-3 pr-4">—</td>
                      <td className="py-3 pr-4 text-roll-gray-500">{formatNumber(periodTotals.enviados)}</td>
                      <td className="py-3 pr-4 text-roll-orange">{formatNumber(periodTotals.lidos)}</td>
                      <td className="py-3 text-roll-orange">{readRate}%</td>
                    </tr>
                  )}
                  {periodRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-roll-gray-400">
                        {campaigns.length === 0
                          ? 'Nenhuma campanha de WhatsApp cadastrada ainda'
                          : 'Nenhum disparo encontrado no período selecionado'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <EngagementDonutChart
              total={periodTotals.enviados}
              engaged={periodTotals.lidos}
              engagedLabel="lidos"
              rateLabel="taxa de leitura"
              notEngagedLabel="sem leitura"
            />
          </section>

          <p className="text-center text-xs text-roll-gray-400">
            Grupo Roll Center · Relatório interno · gerado em {formatDateOnly(new Date())}
          </p>
        </div>
      </div>
    </div>
  )
}
