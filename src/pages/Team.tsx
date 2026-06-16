import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import type { Profile, UserRole } from '@/types/database'

export function TeamPage() {
  const queryClient = useQueryClient()

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data as Profile[]
    },
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-roll-gray-900">Equipe</h1>
        <p className="text-roll-gray-500">Gerencie os membros e permissões</p>
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
                  <th className="pb-3 font-medium">Papel</th>
                  <th className="pb-3 font-medium">Desde</th>
                  <th className="pb-3 font-medium">Alterar Papel</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-roll-gray-100">
                    <td className="py-3 font-medium">{profile.full_name ?? '—'}</td>
                    <td className="py-3">
                      <Badge status={profile.role} label={ROLE_LABELS[profile.role]} />
                    </td>
                    <td className="py-3 text-roll-gray-500">
                      {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3">
                      <Select
                        value={profile.role}
                        onChange={(e) => updateRole.mutate({ id: profile.id, role: e.target.value as UserRole })}
                        className="w-40"
                      >
                        <option value="admin">Administrador</option>
                        <option value="operator">Operador</option>
                        <option value="viewer">Visualizador</option>
                      </Select>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-roll-gray-400">
                      Nenhum membro encontrado. Crie usuários no Supabase Auth.
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
              <li>Gerenciar integrações</li>
              <li>Gerenciar equipe</li>
              <li>Criar e disparar campanhas</li>
            </ul>
          </div>
          <div className="rounded-lg bg-roll-gray-50 p-4">
            <h4 className="font-medium text-blue-600">Operador</h4>
            <ul className="mt-2 space-y-1 text-sm text-roll-gray-600">
              <li>Gerenciar clientes</li>
              <li>Criar e disparar campanhas</li>
              <li>Visualizar métricas</li>
            </ul>
          </div>
          <div className="rounded-lg bg-roll-gray-50 p-4">
            <h4 className="font-medium text-roll-gray-600">Visualizador</h4>
            <ul className="mt-2 space-y-1 text-sm text-roll-gray-600">
              <li>Visualizar dashboard</li>
              <li>Visualizar clientes e campanhas</li>
              <li>Visualizar métricas</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-roll-gray-400">
          Para adicionar novos membros, crie usuários em Authentication no painel do Supabase.
          Após o primeiro login, promova o admin com: UPDATE profiles SET role = 'admin' WHERE id = 'USER_ID';
        </p>
      </Card>
    </div>
  )
}
