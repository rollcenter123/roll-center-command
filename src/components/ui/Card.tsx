import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode
  className?: string
  title?: string
  action?: ReactNode
}) {
  return (
    <div className={`rounded-xl bg-white shadow-sm border border-roll-gray-200 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-roll-gray-100 px-6 py-4">
          {title && <h3 className="text-lg font-semibold text-roll-gray-900">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  color = 'orange',
}: {
  label: string
  value: string | number
  subtext?: string
  icon?: ReactNode
  color?: 'orange' | 'gray' | 'green' | 'red' | 'blue'
}) {
  const colors = {
    orange: 'bg-orange-50 text-roll-orange',
    gray: 'bg-roll-gray-100 text-roll-gray-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-roll-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-roll-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-roll-gray-900">{value}</p>
          {subtext && <p className="mt-1 text-xs text-roll-gray-400">{subtext}</p>}
        </div>
        {icon && (
          <div className={`rounded-lg p-3 ${colors[color]}`}>{icon}</div>
        )}
      </div>
    </div>
  )
}
