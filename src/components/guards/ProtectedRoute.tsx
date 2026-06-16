import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/database'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-roll-gray-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RoleGuard({
  roles,
  children,
  fallback = <Navigate to="/" replace />,
}: {
  roles: UserRole[]
  children: ReactNode
  fallback?: ReactNode
}) {
  const { hasRole, loading } = useAuth()
  if (loading) return null
  if (!hasRole(...roles)) return <>{fallback}</>
  return <>{children}</>
}
