import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Mail,
  MessageCircle,
  Settings,
  UserCog,
  LogOut,
  Upload,
  Cog,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { SettingsModal } from '@/components/settings/SettingsModal'
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
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', permission: 'campaigns_view' },
  { to: '/campanhas/email', icon: Mail, label: 'Emails', permission: 'campaigns_view' },
  { to: '/clientes', icon: Users, label: 'Clientes', permission: 'clients_view' },
  { to: '/equipe', icon: UserCog, label: 'Equipe', permission: 'team_manage' },
  { to: '/clientes/importar', icon: Upload, label: 'Importar', permission: 'import_clients' },
  { to: '/integracoes', icon: Settings, label: 'Integrações', permission: 'integrations' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { profile, signOut, hasPermission } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const visibleItems = navItems.filter((item) => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  const labelClass = `overflow-hidden whitespace-nowrap transition-opacity duration-150 ease-out ${
    collapsed ? 'w-0 opacity-0' : 'opacity-100'
  }`

  return (
    <>
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden bg-roll-gray-800 text-white transition-[width] duration-200 ease-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className={`w-full border-b border-roll-gray-700 py-5 transition-colors hover:bg-roll-gray-700/50 ${
            collapsed ? 'flex justify-center px-2' : 'px-6'
          }`}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
            <Logo size="sm" className="shrink-0 bg-white" />
            <div className={labelClass}>
              <h1 className="text-lg font-bold">Roll Center</h1>
              <p className="text-xs text-roll-gray-400">Central de Comando</p>
            </div>
          </div>
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  isActive
                    ? 'bg-roll-orange text-white'
                    : 'text-roll-gray-300 hover:bg-roll-gray-700 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={labelClass}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={`border-t border-roll-gray-700 ${collapsed ? 'p-2' : 'p-4'}`}>
          <div
            className={`mb-3 flex items-start gap-2 ${
              collapsed ? 'flex-col items-center' : 'justify-between px-2'
            }`}
          >
            <div className={`min-w-0 ${labelClass}`}>
              <p className="truncate text-sm font-medium">{profile?.full_name ?? 'Usuário'}</p>
              <p className="text-xs text-roll-gray-400">
                {profile ? ROLE_LABELS[profile.role] : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="shrink-0 rounded-lg p-2 text-roll-gray-400 transition-colors hover:bg-roll-gray-700 hover:text-white"
              title="Configurações"
              aria-label="Abrir configurações"
            >
              <Cog className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => signOut()}
            title={collapsed ? 'Sair' : undefined}
            className={`flex w-full items-center rounded-lg py-2 text-sm text-roll-gray-300 hover:bg-roll-gray-700 hover:text-white ${
              collapsed ? 'justify-center px-2' : 'gap-2 px-3'
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Sair</span>
          </button>
        </div>
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
