import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { extractCampaignName, type EmailDayRow } from '@/lib/emails-mautic'
import { CHART_COLOR_READ } from '@/lib/chart-colors'
import { calculateOpenRate, formatNumber } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Label, Select } from '@/components/ui/Input'

type RankingScope = 'all' | 'campaign'
type TopLimit = 3 | 5 | 10

interface EmailOpenRateRankingProps {
  dayRows: EmailDayRow[]
}

function buildRankingRows(rows: EmailDayRow[]) {
  return rows.map((row) => ({
    name: row.nome.length > 20 ? `${row.nome.slice(0, 20)}…` : row.nome,
    fullName: row.nome,
    taxa: calculateOpenRate(row.abertos ?? 0, row.enviados ?? 0),
    enviados: row.enviados ?? 0,
    abertos: row.abertos ?? 0,
  }))
}

export function EmailOpenRateRanking({ dayRows }: EmailOpenRateRankingProps) {
  const [scope, setScope] = useState<RankingScope>('all')
  const [topLimit, setTopLimit] = useState<TopLimit>(5)

  const campaignOptions = useMemo(() => {
    const counts = new Map<string, number>()
    dayRows.forEach((row) => {
      const name = extractCampaignName(row.nome)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
  }, [dayRows])

  const [selectedCampaign, setSelectedCampaign] = useState('')

  useEffect(() => {
    if (campaignOptions.length === 0) {
      setSelectedCampaign('')
      return
    }
    setSelectedCampaign((current) =>
      current && campaignOptions.includes(current) ? current : campaignOptions[0],
    )
  }, [campaignOptions])

  const filteredRows = useMemo(() => {
    if (scope === 'all') return dayRows
    return dayRows.filter((row) => extractCampaignName(row.nome) === selectedCampaign)
  }, [dayRows, scope, selectedCampaign])

  const emailRanking = useMemo(
    () =>
      buildRankingRows(filteredRows)
        .sort((a, b) => b.taxa - a.taxa)
        .slice(0, topLimit),
    [filteredRows, topLimit],
  )

  const chartHeight = Math.max(240, topLimit * 52)

  return (
    <Card
      title={`Top ${topLimit} Emails por Taxa de Abertura`}
      action={
        <div className="flex flex-wrap items-end justify-end gap-3">
          <div>
            <Label htmlFor="ranking-scope">Comparar</Label>
            <Select
              id="ranking-scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as RankingScope)}
              className="min-w-[168px]"
            >
              <option value="all">Todas as campanhas</option>
              <option value="campaign">Mesma campanha</option>
            </Select>
          </div>
          {scope === 'campaign' && (
            <div>
              <Label htmlFor="ranking-campaign">Campanha</Label>
              <Select
                id="ranking-campaign"
                value={selectedCampaign}
                onChange={(event) => setSelectedCampaign(event.target.value)}
                className="min-w-[140px]"
              >
                {campaignOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="ranking-top">Exibir</Label>
            <Select
              id="ranking-top"
              value={topLimit}
              onChange={(event) => setTopLimit(Number(event.target.value) as TopLimit)}
              className="min-w-[100px]"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </Select>
          </div>
        </div>
      }
    >
      {emailRanking.length === 0 ? (
        <p className="py-12 text-center text-sm text-roll-gray-400">
          Nenhum email disponível para o filtro selecionado.
        </p>
      ) : (
        <div className="w-full min-w-0" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={emailRanking} layout="vertical" margin={{ right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} unit="%" domain={[0, 'dataMax + 10']} />
            <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload as { fullName?: string } | undefined
                return item?.fullName ?? ''
              }}
              formatter={(_value, _name, item) => {
                const row = item?.payload as {
                  taxa: number
                  enviados: number
                  abertos: number
                } | undefined
                if (!row) return ['—', 'Taxa de abertura']
                return [
                  `${row.taxa}% · ${formatNumber(row.abertos)} aberturas de ${formatNumber(row.enviados)} enviados`,
                  'Taxa de abertura',
                ]
              }}
            />
            <Bar dataKey="taxa" fill={CHART_COLOR_READ} name="Taxa %" radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="taxa"
                position="right"
                content={(props) => {
                  const p = props as {
                    payload?: { taxa: number; abertos: number; enviados: number }
                    x?: number
                    y?: number
                    width?: number
                    height?: number
                  }
                  const row = p.payload
                  if (
                    !row ||
                    p.x == null ||
                    p.y == null ||
                    p.width == null ||
                    p.height == null
                  ) {
                    return null
                  }
                  const x = Number(p.x)
                  const y = Number(p.y)
                  const width = Number(p.width)
                  const height = Number(p.height)
                  return (
                    <text
                      x={x + width + 8}
                      y={y + height / 2}
                      fill="#4b5563"
                      fontSize={11}
                      dominantBaseline="middle"
                    >
                      {`${row.taxa}% (${formatNumber(row.abertos)}/${formatNumber(row.enviados)})`}
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-3 text-xs text-roll-gray-400">
        Ordenado do maior para o menor ·{' '}
        {scope === 'all' ? 'todas as campanhas' : `campanha: ${selectedCampaign}`}
      </p>
    </Card>
  )
}
