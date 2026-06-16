import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSupabaseAdmin } from './supabase-admin.ts'

export async function verifyAdmin(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin' || profile.is_active === false) return null
  return user
}
