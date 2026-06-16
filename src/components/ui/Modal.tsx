import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-roll-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-roll-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-roll-gray-100">
            <X className="h-5 w-5 text-roll-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
