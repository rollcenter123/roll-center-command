import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatPhone, ROLE_LABELS } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MemberFormModal } from '@/components/team/MemberFormModal'
import type { Profile } from '@/types/database'

function normalizeProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role: row.role as Profile['role'],
    is_active: row.is_active !== false,
    permissions: (row.permissions as Profile['permissions']) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export function TeamPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Profile | null>(null)

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return (data ?? []).map(normalizeProfile)
    },
  })

  const openCreate = () => {
    setEditingMember(null)
    setModalOpen(true)
  }

  const openEdit = (profile: Profile) => {
    setEditingMember(profile)
    setModalOpen(true)
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-roll-gray-900">Equipe</h1>
          <p className="text-roll-gray-500">Gerencie os membros e permissões</p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          Novo membro
        </Button>
      </div>

      <Card title="Membros">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-roll-gray-200 text-left text-roll-gray-500">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">E-mail</th>
                  <th className="pb-3 font-medium">Telefone</th>
                  <th className="pb-3 font-medium">Papel</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Desde</th>
                  <th className="pb-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-roll-gray-100">
                    <td className="py-3 font-medium">{profile.full_name ?? '—'}</td>
                    <td className="py-3 text-roll-gray-600">{profile.email ?? '—'}</td>
                    <td className="py-3 text-roll-gray-600">{formatPhone(profile.phone)}</td>
                    <td className="py-3">
                      <Badge status={profile.role} label={ROLE_LABELS[profile.role]} />
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          profile.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {profile.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 text-roll-gray-500">
                      {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3">
                      <Button variant="outline" size="sm" onClick={() => openEdit(profile)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-roll-gray-400">
                      Nenhum membro encontrado. Clique em &quot;Novo membro&quot; para adicionar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Permissões por Papel" className="mt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-roll-gray-50 p-4">
            <h4 className="font-medium text-roll-orange">Administrador</h4>
            <ul className="mt-2 space-y-1 text-sm text-roll-gray-600">
              <li>Acesso total ao sistema</li>
              <li>Gerenciar integrações e equipe</li>
              <li>Criar e disparar campanhas</li>
              <li>Baixar relatórios em PDF</li>
            </ul>
          </div>
          <div className="rounded-lg bg-roll-gray-50 p-4">
            <h4 className="font-medium text-blue-600">Operador</h4>
            <ul className="mt-2 space-y-1 text-sm text-roll-gray-600">
              <li>Gerenciar clientes</li>
              <li>Criar e disparar campanhas</li>
              <li>Visualizar métricas e baixar PDF</li>
            </ul>
          </div>
          <div className="rounded-lg bg-roll-gray-50 p-4">
            <h4 className="font-medium text-roll-gray-600">Visualizador</h4>
            <ul className="mt-2 space-y-1 text-sm text-roll-gray-600">
              <li>Visualizar dashboard, clientes e campanhas</li>
              <li>Visualizar métricas</li>
              <li>Baixar relatórios em PDF</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-roll-gray-400">
          Ao criar ou editar um membro, você pode personalizar cada permissão individualmente além do tipo de perfil.
        </p>
      </Card>

      <MemberFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        member={editingMember}
      />
    </div>
  )
}
