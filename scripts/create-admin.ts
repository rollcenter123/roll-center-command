import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(import.meta.dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const email = process.argv[2] ?? process.env.ADMIN_EMAIL
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD
const fullName = process.argv[4] ?? 'Roll Center Admin'

if (!supabaseUrl || !serviceKey) {
  console.error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

if (!email || !password) {
  console.error('Uso: npm run create:admin -- email@exemplo.com SenhaForte "Nome Admin"')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: listData, error: listError } = await admin.auth.admin.listUsers()
  if (listError) throw listError

  const existing = listData.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  )

  let userId = existing?.id

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) throw error
    userId = data.user.id
    console.log('Usuário existente atualizado:', email)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) throw error
    userId = data.user.id
    console.log('Usuário criado:', email)
  }

  if (!userId) throw new Error('Não foi possível obter o ID do usuário')

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: fullName,
        role: 'admin',
      },
      { onConflict: 'id' },
    )

  if (profileError) throw profileError

  console.log('Perfil promovido para admin:', userId)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
