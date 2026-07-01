import { Mail, MessageCircle } from 'lucide-react'
import type { ClientChannelTab } from '@/lib/clients-channels'

const CHANNEL_OPTIONS: {
  value: ClientChannelTab
  label: string
  icon: typeof Mail
}[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'email', label: 'Email', icon: Mail },
]

interface ClientChannelSelectorProps {
  value: ClientChannelTab
  onChange: (value: ClientChannelTab) => void
}

export function ClientChannelSelector({ value, onChange }: ClientChannelSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHANNEL_OPTIONS.map(({ value: optionValue, label, icon: Icon }) => {
        const isActive = value === optionValue
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-roll-orange text-white shadow-sm'
                : 'border border-roll-gray-300 bg-white text-roll-gray-700 hover:bg-roll-gray-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
