import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import type { ProfilePermissions } from '../src/types/database.ts'

config({ path: resolve(import.meta.dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const DISABLED_PERMISSIONS: ProfilePermissions = {
  dashboard: false,
  clients_view: false,
  clients_edit: false,
  campaigns_view: false,
  campaigns_edit: false,
  metrics_view: false,
  metrics_pdf: false,
  import_clients: false,
  integrations: false,
  team_manage: false,
}

const TEAM_MEMBERS = [
  {
    fullName: 'Felipe',
    email: 'felipe@rollcenter.com',
    go42MemberId: 'd4cac14e-5abf-4765-aec6-94cf6df0320d',
    funnelName: 'Disparos Felipe',
  },
  {
    fullName: 'Luis Gustavo',
    email: 'luisgustavo@rollcenter.com',
    go42MemberId: '74c4dae8-3726-47ca-8c6a-7c3bd48cbf82',
    funnelName: 'Disparos Luis Gustavo',
  },
] as const

if (!supabaseUrl || !serviceKey) {
  console.error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const password = process.argv[2] ?? process.env.TEAM_SETUP_PASSWORD
if (!password) {
  console.error('Uso: npm run create:team -- SenhaCompartilhada')
  console.error('  ou defina TEAM_SETUP_PASSWORD no .env')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function upsertMember(member: (typeof TEAM_MEMBERS)[number]) {
  const email = member.email.toLowerCase()

  const { data: listData, error: listError } = await admin.auth.admin.listUsers()
  if (listError) throw listError

  const existing = listData.users.find((user) => user.email?.toLowerCase() === email)
  let userId = existing?.id

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: member.fullName },
      ban_duration: '876000h',
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Usuário atualizado (inativo): ${email}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: member.fullName },
    })
    if (error) throw error
    userId = data.user.id

    await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
    console.log(`Usuário criado (inativo): ${email}`)
  }

  if (!userId) throw new Error(`Não foi possível obter ID para ${email}`)

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      full_name: member.fullName,
      email,
      role: 'viewer',
      permissions: DISABLED_PERMISSIONS,
      is_active: false,
      go42_member_id: member.go42MemberId,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    if (profileError.message.includes('go42_member_id')) {
      throw new Error(
        'Coluna go42_member_id não existe. Execute a migration 008_profile_go42_member.sql no Supabase.',
      )
    }
    throw profileError
  }

  console.log(`  Perfil viewer inativo · funil: ${member.funnelName}`)
  console.log(`  Go42 member id: ${member.go42MemberId}`)
}

async function main() {
  console.log('Criando membros da equipe (viewer, inativos, sem permissões)...\n')
  for (const member of TEAM_MEMBERS) {
    await upsertMember(member)
    console.log('')
  }
  console.log('Concluído. Ative os usuários e permissões em Equipe quando for usar.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
