import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { PermissionKey } from '@/lib/permissions'
import type { UserRole } from '@/types/database'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-roll-gray-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (profile && profile.is_active === false) return <Navigate to="/login" replace />
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

export function PermissionGuard({
  permission,
  children,
  fallback = <Navigate to="/" replace />,
}: {
  permission: PermissionKey
  children: ReactNode
  fallback?: ReactNode
}) {
  const { hasPermission, loading } = useAuth()
  if (loading) return null
  if (!hasPermission(permission)) return <>{fallback}</>
  return <>{children}</>
}
