import { Bot, KanbanSquare, Tag } from 'lucide-react'

const ICON_ACTIVE =
  'text-roll-orange fill-roll-orange/20 stroke-[#4c3d6b] drop-shadow-[0_1px_0_rgba(76,61,107,0.15)]'
const ICON_INACTIVE = 'fill-transparent text-roll-gray-400 stroke-roll-gray-400 grayscale opacity-60'

function toolbarIconClass(active: boolean, className: string) {
  return `${className} transition-all duration-300 ease-in-out ${
    active ? ICON_ACTIVE : ICON_INACTIVE
  }`
}

interface ToolbarIconProps {
  active?: boolean
  className?: string
}

export function TagToolbarIcon({ active = false, className = 'h-6 w-6' }: ToolbarIconProps) {
  return <Tag className={toolbarIconClass(active, className)} strokeWidth={2.25} aria-hidden />
}

export function CrmToolbarIcon({ active = false, className = 'h-6 w-6' }: ToolbarIconProps) {
  return <KanbanSquare className={toolbarIconClass(active, className)} strokeWidth={2.25} aria-hidden />
}

export function VirtualAttendantIcon({ active = false, className = 'h-6 w-6' }: ToolbarIconProps) {
  return <Bot className={toolbarIconClass(active, className)} strokeWidth={2.25} aria-hidden />
}
