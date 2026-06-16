import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyAdmin } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type UserRole = 'admin' | 'operator' | 'viewer'

interface MemberPayload {
  full_name: string
  email: string
  phone?: string | null
  password?: string
  role: UserRole
  permissions: Record<string, boolean>
  is_active?: boolean
}

function isValidRole(role: string): role is UserRole {
  return role === 'admin' || role === 'operator' || role === 'viewer'
}

function validateMemberPayload(body: MemberPayload) {
  if (!body.full_name?.trim()) return 'Nome completo é obrigatório'
  if (!body.email?.trim()) return 'E-mail é obrigatório'
  if (!isValidRole(body.role)) return 'Papel inválido'
  if (!body.permissions || typeof body.permissions !== 'object') return 'Permissões inválidas'
  return null
}

function validateCreatePayload(body: MemberPayload) {
  const base = validateMemberPayload(body)
  if (base) return base
  if (!body.password?.trim()) return 'Senha é obrigatória'
  if (body.password.length < 6) return 'A senha deve ter pelo menos 6 caracteres'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const caller = await verifyAdmin(req)
    if (!caller) return errorResponse('Apenas administradores podem gerenciar a equipe', 403)

    const body = await req.json() as { action: string } & MemberPayload & { id?: string }
    const admin = getSupabaseAdmin()

    if (body.action === 'create') {
      const validationError = validateCreatePayload(body)
      if (validationError) return errorResponse(validationError)

      const email = body.email.trim().toLowerCase()
      const fullName = body.full_name.trim()
      const phone = body.phone?.trim() || null
      const password = body.password!.trim()
      const isActive = body.is_active !== false

      const { data: listData, error: listError } = await admin.auth.admin.listUsers()
      if (listError) return errorResponse(listError.message, 500)

      const existing = listData.users.find((user) => user.email?.toLowerCase() === email)
      let userId = existing?.id

      if (existing) {
        const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone },
          ban_duration: isActive ? 'none' : '876000h',
        })
        if (error) return errorResponse(error.message)
        userId = data.user.id
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone },
        })
        if (error) return errorResponse(error.message)
        userId = data.user.id
      }

      if (!userId) return errorResponse('Não foi possível criar o usuário', 500)

      const { error: profileError } = await admin
        .from('profiles')
        .update({
          full_name: fullName,
          email,
          phone,
          role: body.role,
          permissions: body.permissions,
          is_active: isActive,
        })
        .eq('id', userId)

      if (profileError) return errorResponse(profileError.message, 500)

      return jsonResponse({ id: userId, created: !existing })
    }

    if (body.action === 'update') {
      if (!body.id) return errorResponse('ID do membro é obrigatório')
      const validationError = validateMemberPayload(body)
      if (validationError) return errorResponse(validationError)

      const fullName = body.full_name.trim()
      const phone = body.phone?.trim() || null
      const isActive = body.is_active !== false

      const { error: profileError } = await admin
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          role: body.role,
          permissions: body.permissions,
          is_active: isActive,
        })
        .eq('id', body.id)

      if (profileError) return errorResponse(profileError.message, 500)

      await admin.auth.admin.updateUserById(body.id, {
        user_metadata: { full_name: fullName, phone },
        ban_duration: isActive ? 'none' : '876000h',
      })

      return jsonResponse({ success: true })
    }

    return errorResponse('Ação inválida')
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Erro desconhecido', 500)
  }
})
