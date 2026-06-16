import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { getDefaultPermissions } from '@/lib/permissions'
import { createTeamMember, updateTeamMember } from '@/lib/team-api'
import { formatPhone, normalizePhone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { FieldGroup, Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PermissionToggles } from '@/components/team/PermissionToggles'
import type { Profile, UserRole } from '@/types/database'

type Step = 'info' | 'permissions'

interface MemberFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  member?: Profile | null
}

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  role: 'viewer' as UserRole,
  permissions: getDefaultPermissions('viewer'),
  is_active: true,
}

export function MemberFormModal({ open, onClose, onSuccess, member }: MemberFormModalProps) {
  const isEditing = Boolean(member)
  const [step, setStep] = useState<Step>('info')
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    if (member) {
      setForm({
        full_name: member.full_name ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        role: member.role,
        permissions: { ...getDefaultPermissions(member.role), ...member.permissions },
        is_active: member.is_active !== false,
      })
      setStep('permissions')
    } else {
      setForm(emptyForm)
      setStep('info')
    }
    setError(null)
  }, [open, member])

  const handleRoleChange = (role: UserRole) => {
    setForm((current) => ({
      ...current,
      role,
      permissions: getDefaultPermissions(role),
    }))
  }

  const handleContinue = () => {
    if (!form.full_name.trim()) {
      setError('Informe o nome completo')
      return
    }
    if (!form.email.trim()) {
      setError('Informe o e-mail')
      return
    }
    setError(null)
    setStep('permissions')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() ? normalizePhone(form.phone.trim()) : undefined,
        role: form.role,
        permissions: form.permissions,
        is_active: form.is_active,
      }

      if (isEditing && member) {
        await updateTeamMember({ id: member.id, ...payload })
      } else {
        await createTeamMember(payload)
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar membro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar membro' : 'Novo membro'}
      size="lg"
    >
      {step === 'info' && !isEditing ? (
        <div>
          <FieldGroup label="Nome completo">
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Ex.: Maria Silva"
            />
          </FieldGroup>
          <FieldGroup label="E-mail">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </FieldGroup>
          <FieldGroup label="Telefone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </FieldGroup>

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleContinue}>
              Continuar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 rounded-lg bg-roll-gray-50 px-4 py-3">
            <p className="font-medium text-roll-gray-900">{form.full_name || '—'}</p>
            <p className="text-sm text-roll-gray-600">{form.email}</p>
            {form.phone && (
              <p className="text-sm text-roll-gray-500">{formatPhone(form.phone)}</p>
            )}
          </div>

          <FieldGroup label="Tipo de perfil">
            <Select
              value={form.role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            >
              <option value="admin">Administrador</option>
              <option value="operator">Operador</option>
              <option value="viewer">Visualizador</option>
            </Select>
            <p className="mt-1 text-xs text-roll-gray-400">
              Ao mudar o perfil, as permissões são ajustadas ao padrão do papel. Você pode personalizar abaixo.
            </p>
          </FieldGroup>

          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-roll-gray-700">Permissões do perfil</p>
            <PermissionToggles
              permissions={form.permissions}
              onChange={(permissions) => setForm({ ...form, permissions })}
            />
          </div>

          <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-roll-gray-200 px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-roll-gray-300 text-roll-orange focus:ring-roll-orange"
            />
            <div>
              <p className="text-sm font-medium text-roll-gray-900">Membro ativo</p>
              <p className="text-xs text-roll-gray-500">Desmarque para desabilitar o acesso ao sistema</p>
            </div>
          </label>

          {!isEditing && (
            <p className="mb-4 text-xs text-roll-gray-400">
              Um convite será enviado para o e-mail informado para o membro definir a senha.
            </p>
          )}

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-between gap-2">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setStep('info')}>
                Voltar
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            )}
            <Button onClick={handleSubmit} loading={loading}>
              <UserPlus className="h-4 w-4" />
              {isEditing ? 'Salvar alterações' : 'Criar membro'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
