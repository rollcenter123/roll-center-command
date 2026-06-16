import type { ProfilePermissions, UserRole } from '@/types/database'

export const PERMISSION_KEYS = [
  'dashboard',
  'clients_view',
  'clients_edit',
  'campaigns_view',
  'campaigns_edit',
  'metrics_view',
  'metrics_pdf',
  'import_clients',
  'integrations',
  'team_manage',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: 'Visualizar dashboard',
  clients_view: 'Visualizar clientes',
  clients_edit: 'Gerenciar clientes',
  campaigns_view: 'Visualizar campanhas',
  campaigns_edit: 'Criar e disparar campanhas',
  metrics_view: 'Visualizar métricas',
  metrics_pdf: 'Baixar relatórios em PDF',
  import_clients: 'Importar clientes',
  integrations: 'Gerenciar integrações',
  team_manage: 'Gerenciar equipe',
}

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, ProfilePermissions> = {
  admin: {
    dashboard: true,
    clients_view: true,
    clients_edit: true,
    campaigns_view: true,
    campaigns_edit: true,
    metrics_view: true,
    metrics_pdf: true,
    import_clients: true,
    integrations: true,
    team_manage: true,
  },
  operator: {
    dashboard: true,
    clients_view: true,
    clients_edit: true,
    campaigns_view: true,
    campaigns_edit: true,
    metrics_view: true,
    metrics_pdf: true,
    import_clients: true,
    integrations: false,
    team_manage: false,
  },
  viewer: {
    dashboard: true,
    clients_view: true,
    clients_edit: false,
    campaigns_view: true,
    campaigns_edit: false,
    metrics_view: true,
    metrics_pdf: true,
    import_clients: false,
    integrations: false,
    team_manage: false,
  },
}

export function getDefaultPermissions(role: UserRole): ProfilePermissions {
  return { ...ROLE_DEFAULT_PERMISSIONS[role] }
}

export function resolvePermissions(
  role: UserRole,
  stored: Partial<ProfilePermissions> | null | undefined,
): ProfilePermissions {
  const defaults = getDefaultPermissions(role)
  if (!stored || Object.keys(stored).length === 0) return defaults
  return { ...defaults, ...stored }
}

export function hasPermission(
  profile: { role: UserRole; permissions?: Partial<ProfilePermissions> | null; is_active?: boolean },
  permission: PermissionKey,
): boolean {
  if (profile.is_active === false) return false
  return resolvePermissions(profile.role, profile.permissions)[permission] === true
}
