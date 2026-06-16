import { Check, X } from 'lucide-react'
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
} from '@/lib/permissions'
import type { ProfilePermissions } from '@/types/database'

interface PermissionTogglesProps {
  permissions: ProfilePermissions
  onChange: (permissions: ProfilePermissions) => void
  disabled?: boolean
}

export function PermissionToggles({ permissions, onChange, disabled }: PermissionTogglesProps) {
  const toggle = (key: PermissionKey) => {
    if (disabled) return
    onChange({ ...permissions, [key]: !permissions[key] })
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PERMISSION_KEYS.map((key) => {
        const enabled = permissions[key]
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => toggle(key)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              enabled
                ? 'border-roll-orange/40 bg-orange-50 text-roll-gray-900'
                : 'border-roll-gray-200 bg-roll-gray-50 text-roll-gray-500'
            } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-roll-orange/60'}`}
          >
            <span>{PERMISSION_LABELS[key]}</span>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                enabled ? 'bg-roll-orange text-white' : 'bg-roll-gray-300 text-white'
              }`}
            >
              {enabled ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
