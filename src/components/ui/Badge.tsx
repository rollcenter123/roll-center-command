const variants: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  converted: 'bg-green-100 text-green-700',
  inactive: 'bg-roll-gray-100 text-roll-gray-600',
  draft: 'bg-roll-gray-100 text-roll-gray-600',
  scheduled: 'bg-purple-100 text-purple-700',
  running: 'bg-roll-orange/10 text-roll-orange',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-roll-gray-100 text-roll-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  opened: 'bg-roll-orange/10 text-roll-orange',
  clicked: 'bg-purple-100 text-purple-700',
  read: 'bg-green-100 text-green-700',
  replied: 'bg-green-100 text-green-700',
  bounced: 'bg-red-100 text-red-700',
  unsubscribed: 'bg-red-100 text-red-700',
  admin: 'bg-roll-orange/10 text-roll-orange',
  operator: 'bg-blue-100 text-blue-700',
  viewer: 'bg-roll-gray-100 text-roll-gray-600',
}

export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] ?? 'bg-roll-gray-100 text-roll-gray-600'}`}>
      {label ?? status}
    </span>
  )
}
