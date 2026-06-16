import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Mail,
  MessageCircle,
  BarChart3,
  Settings,
  UserCog,
  LogOut,
  Upload,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS } from '@/lib/utils'
import type { PermissionKey } from '@/lib/permissions'

interface NavItem {
  to: string
  icon: typeof LayoutDashboard
  label: string
  permission?: PermissionKey
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
  { to: '/campanhas/whatsapp', icon: MessageCircle, label: 'WhatsApp', permission: 'campaigns_view' },
  { to: '/campanhas/email', icon: Mail, label: 'Emails', permission: 'campaigns_view' },
  { to: '/clientes', icon: Users, label: 'Clientes', permission: 'clients_view' },
  { to: '/metricas', icon: BarChart3, label: 'Métricas', permission: 'metrics_view' },
  { to: '/equipe', icon: UserCog, label: 'Equipe', permission: 'team_manage' },
  { to: '/clientes/importar', icon: Upload, label: 'Importar', permission: 'import_clients' },
  { to: '/integracoes', icon: Settings, label: 'Integrações', permission: 'integrations' },
]

export function Sidebar() {
  const { profile, signOut, hasPermission } = useAuth()

  const visibleItems = navItems.filter((item) => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-roll-gray-800 text-white">
      <div className="border-b border-roll-gray-700 px-6 py-5">
        <div className="flex items-center gap-3">
          <Logo size="sm" className="bg-white" />
          <div>
            <h1 className="text-lg font-bold">Roll Center</h1>
            <p className="text-xs text-roll-gray-400">Central de Comando</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-roll-orange text-white'
                  : 'text-roll-gray-300 hover:bg-roll-gray-700 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-roll-gray-700 p-4">
        <div className="mb-3 px-2">
          <p className="truncate text-sm font-medium">{profile?.full_name ?? 'Usuário'}</p>
          <p className="text-xs text-roll-gray-400">
            {profile ? ROLE_LABELS[profile.role] : ''}
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-roll-gray-300 hover:bg-roll-gray-700 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
