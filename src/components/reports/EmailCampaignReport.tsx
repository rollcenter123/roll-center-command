import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { exportElementToPdf } from '@/lib/export-pdf'
import { Download, Eye, Mail, Percent, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  buildDayRows,
  fetchEmailsMautic,
  filterByRange,
  sumMetrics,
  syncEmailsFromMautic,
} from '@/lib/emails-mautic'
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

interface EmailCampaignReportProps {
  showPageHeader?: boolean
  showSyncButton?: boolean
  campaignSelector?: React.ReactNode
}

export function EmailCampaignReport({
  showPageHeader = false,
  showSyncButton = true,
  campaignSelector,
}: EmailCampaignReportProps) {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const reportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [dailyDate, setDailyDate] = useState(() => toDateInputValue(getYesterday()))
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const { data: emails = [], isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['emails-mautic'],
    queryFn: fetchEmailsMautic,
    refetchInterval: 60_000,
  })

  const allDayRows = useMemo(() => buildDayRows(emails), [emails])

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
    return filterByRange(allDayRows, rangeStart, rangeEnd)
  }, [allDayRows, rangeStart, rangeEnd])

  const periodTotals = useMemo(() => sumMetrics(periodRows), [periodRows])
  const openRate = calculateOpenRate(periodTotals.abertos, periodTotals.enviados)

  const dailyRows = useMemo(
    () => allDayRows.filter((row) => row.dateKey === dailyDate),
    [allDayRows, dailyDate],
  )

  const dailyTotals = useMemo(() => sumMetrics(dailyRows), [dailyRows])
  const dailyHighlight = dailyRows[0]

  const dailyChartData = useMemo(
    () => [
      { metric: 'Enviados', valor: dailyTotals.enviados, fill: CHART_COLOR_SENT },
      { metric: 'Aberturas', valor: dailyTotals.abertos, fill: CHART_COLOR_READ },
    ],
    [dailyTotals],
  )

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const result = await syncEmailsFromMautic()
      await queryClient.invalidateQueries({ queryKey: ['emails-mautic'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      return result
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Falha ao atualizar os emails')
      return null
    } finally {
      setSyncing(false)
    }
  }, [queryClient])

  const autoSynced = useRef(false)
  useEffect(() => {
    if (autoSynced.current) return
    autoSynced.current = true
    void handleSync()
  }, [handleSync])

  const handleExportPdf = useCallback(async () => {
    const element = reportRef.current
    if (!element) return

    setExporting(true)
    try {
      await exportElementToPdf(
        element,
        `relatorio-email-rollcenter-${toDateInputValue(new Date())}.pdf`,
      )
    } catch (err) {
      console.error('Falha ao exportar PDF:', err)
      setSyncError(
        err instanceof Error
          ? `Falha ao gerar PDF: ${err.message}`
          : 'Falha ao gerar PDF. Tente novamente.',
      )
    } finally {
      setExporting(false)
    }
  }, [])

  const canSync = hasPermission('campaigns_edit')
  const canExportPdf = hasPermission('metrics_pdf')

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
              <p className="text-roll-gray-500">Relatório da campanha de e-mail</p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {campaignSelector}
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              {showSyncButton && canSync && (
                <Button variant="outline" onClick={handleSync} loading={syncing}>
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              )}
              {canExportPdf && (
                <Button onClick={handleExportPdf} loading={exporting}>
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {syncError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {syncError}
        </div>
      )}

      {allDayRows.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nenhum e-mail com data de disparo encontrado. Clique em <strong>Atualizar</strong> para
          buscar os dados mais recentes (incluindo o dia 005 de hoje).
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
        data-report-root
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
              <h2 className="text-2xl font-bold sm:text-3xl">Campanha de E-mail</h2>
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
              label="e-mails enviados"
              value={formatNumber(periodTotals.enviados)}
              icon={<Mail className="h-5 w-5" />}
            />
            <HighlightCard
              label="aberturas"
              value={formatNumber(periodTotals.abertos)}
              icon={<Eye className="h-5 w-5" />}
            />
            <HighlightCard
              label="taxa média de abertura"
              value={`${openRate}%`}
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
                <Label htmlFor="daily-date">Data do disparo</Label>
                <Input
                  id="daily-date"
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
                {formatNumber(dailyTotals.enviados)} e-mails enviados
                {' · '}
                {formatNumber(dailyTotals.abertos)} aberturas
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
                  <Label htmlFor="range-start">Data inicial</Label>
                  <Input
                    id="range-start"
                    type="date"
                    value={rangeStart}
                    data-export-date={formatDateKey(rangeStart)}
                    min={allDayRows[0]?.dateKey}
                    max={rangeEnd || allDayRows[allDayRows.length - 1]?.dateKey}
                    onChange={(event) => setRangeStart(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="range-end">Data final</Label>
                  <Input
                    id="range-end"
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
                    <th className="pb-3 pr-4 font-semibold">Aberturas</th>
                    <th className="pb-3 font-semibold">% Abertura</th>
                  </tr>
                </thead>
                <tbody>
                  {[...periodRows].reverse().map((row) => (
                    <tr key={row.id} className="border-b border-roll-gray-100">
                      <td className="py-3 pr-4 font-medium text-roll-gray-900">{row.dayNumber}</td>
                      <td className="py-3 pr-4 text-roll-gray-900">{formatDateKey(row.dateKey)}</td>
                      <td className="py-3 pr-4 text-roll-gray-500">{formatNumber(row.enviados ?? 0)}</td>
                      <td className="py-3 pr-4 font-medium text-roll-orange">{formatNumber(row.abertos ?? 0)}</td>
                      <td className="py-3 font-medium text-roll-orange">
                        {calculateOpenRate(row.abertos ?? 0, row.enviados ?? 0)}%
                      </td>
                    </tr>
                  ))}
                  {periodRows.length > 0 && (
                    <tr className="bg-roll-gray-50 font-semibold text-roll-gray-900">
                      <td className="py-3 pr-4">TOTAL</td>
                      <td className="py-3 pr-4">—</td>
                      <td className="py-3 pr-4 text-roll-gray-500">{formatNumber(periodTotals.enviados)}</td>
                      <td className="py-3 pr-4 text-roll-orange">{formatNumber(periodTotals.abertos)}</td>
                      <td className="py-3 text-roll-orange">{openRate}%</td>
                    </tr>
                  )}
                  {periodRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-roll-gray-400">
                        Nenhum disparo encontrado no período selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <EngagementDonutChart
              total={periodTotals.enviados}
              engaged={periodTotals.abertos}
              engagedLabel="aberturas"
              rateLabel="taxa de abertura"
              notEngagedLabel="sem abertura"
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
