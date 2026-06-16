import { supabase } from '@/lib/supabase'
import type { ProfilePermissions, UserRole } from '@/types/database'

export interface CreateMemberInput {
  full_name: string
  email: string
  phone?: string
  role: UserRole
  permissions: ProfilePermissions
  is_active?: boolean
}

export interface UpdateMemberInput extends CreateMemberInput {
  id: string
}

export async function createTeamMember(input: CreateMemberInput) {
  const { data, error } = await supabase.functions.invoke('manage-team-member', {
    body: { action: 'create', ...input },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as { id: string; invited: boolean }
}

export async function updateTeamMember(input: UpdateMemberInput) {
  const { data, error } = await supabase.functions.invoke('manage-team-member', {
    body: { action: 'update', ...input },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as { success: boolean }
}
