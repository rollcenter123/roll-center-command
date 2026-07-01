import { Bot, KanbanSquare, Tag } from 'lucide-react'

const ICON_ORANGE = 'text-roll-orange fill-roll-orange/15 stroke-roll-orange'
const ICON_INACTIVE = 'fill-transparent text-roll-gray-400 stroke-roll-gray-400 grayscale opacity-60'

function orangeIconClass(className: string) {
  return `${className} transition-all duration-300 ease-in-out ${ICON_ORANGE}`
}

function toggleIconClass(active: boolean, className: string) {
  return `${className} transition-all duration-300 ease-in-out ${
    active ? ICON_ORANGE : ICON_INACTIVE
  }`
}

interface ToolbarIconProps {
  active?: boolean
  className?: string
}

export function TagToolbarIcon({ className = 'h-5 w-5' }: ToolbarIconProps) {
  return <Tag className={orangeIconClass(className)} strokeWidth={2.25} aria-hidden />
}

export function CrmToolbarIcon({ className = 'h-5 w-5' }: ToolbarIconProps) {
  return <KanbanSquare className={orangeIconClass(className)} strokeWidth={2.25} aria-hidden />
}

export function VirtualAttendantIcon({ active = false, className = 'h-5 w-5' }: ToolbarIconProps) {
  return <Bot className={toggleIconClass(active, className)} strokeWidth={2.25} aria-hidden />
}
