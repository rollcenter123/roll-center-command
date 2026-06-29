import { Mail, MessageCircle } from 'lucide-react'

export type CampaignReportType = 'email' | 'whatsapp'

const CAMPAIGN_OPTIONS: {
  value: CampaignReportType
  label: string
  icon: typeof Mail
}[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'email', label: 'Email', icon: Mail },
]

interface CampaignTypeSelectorProps {
  value: CampaignReportType
  onChange: (value: CampaignReportType) => void
}

export function CampaignTypeSelector({ value, onChange }: CampaignTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CAMPAIGN_OPTIONS.map(({ value: optionValue, label, icon: Icon }) => {
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
