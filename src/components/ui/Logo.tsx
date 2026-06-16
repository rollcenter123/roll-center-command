import { ROLL_CENTER_LOGO_URL } from '@/lib/branding'

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
} as const

interface LogoProps {
  size?: keyof typeof sizeClasses
  className?: string
}

export function Logo({ size = 'sm', className }: LogoProps) {
  return (
    <img
      src={ROLL_CENTER_LOGO_URL}
      alt="Roll Center"
      className={`shrink-0 rounded-lg object-contain ${sizeClasses[size]}${className ? ` ${className}` : ''}`}
    />
  )
}
