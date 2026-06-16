import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLOR_READ, CHART_COLOR_SENT } from '@/lib/chart-colors'
import { calculateOpenRate, formatNumber } from '@/lib/utils'

interface EngagementDonutChartProps {
  total: number
  engaged: number
  engagedLabel: string
  rateLabel: string
  notEngagedLabel?: string
}

export function EngagementDonutChart({
  total,
  engaged,
  engagedLabel,
  rateLabel,
  notEngagedLabel = 'Sem abertura',
}: EngagementDonutChartProps) {
  const rate = calculateOpenRate(engaged, total)
  const remainder = Math.max(total - engaged, 0)

  const chartData = [
    { name: engagedLabel, value: engaged, fill: CHART_COLOR_READ },
    { name: notEngagedLabel, value: remainder, fill: CHART_COLOR_SENT },
  ]

  if (total === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-roll-gray-400">
        Sem dados para exibir no período
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-center lg:gap-12">
      <div className="relative h-72 w-full max-w-sm">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-roll-orange">{rate}%</span>
          <span className="mt-1 text-sm font-medium text-roll-gray-600">{rateLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 text-center lg:text-left">
        <div>
          <p className="text-3xl font-bold text-roll-orange">{formatNumber(engaged)}</p>
          <p className="text-sm text-roll-gray-500">{engagedLabel}</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-roll-gray-400">{formatNumber(total)}</p>
          <p className="text-sm text-roll-gray-500">disparados no período</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
          <div className="flex items-center gap-2 text-sm text-roll-gray-600">
            <span className="h-3 w-3 rounded-full bg-roll-orange" />
            {engagedLabel}
          </div>
          <div className="flex items-center gap-2 text-sm text-roll-gray-600">
            <span className="h-3 w-3 rounded-full bg-roll-gray-300" />
            {notEngagedLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
