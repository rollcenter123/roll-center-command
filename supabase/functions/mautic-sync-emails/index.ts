import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getMauticCredentials, mauticFetch } from '../_shared/mautic.ts'
import {
  resetMauticEmailSyncCursor,
  syncMauticEmailCatalog,
  syncMauticEmailSends,
} from '../_shared/mautic-email-sync.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const fullResync = Boolean(body.full_resync)
    const credentials = await getMauticCredentials()
    const supabase = getSupabaseAdmin()

    if (fullResync) {
      await resetMauticEmailSyncCursor(supabase)
    }

    const emailsSynced = await syncMauticEmailCatalog(supabase, mauticFetch)

    let sendResult
    try {
      sendResult = await syncMauticEmailSends(supabase, mauticFetch)
    } catch (sendError) {
      return errorResponse(
        `Emails sincronizados (${emailsSynced}), mas falha ao importar contatos: ${
          sendError instanceof Error ? sendError.message : 'erro desconhecido'
        }`,
        500,
      )
    }

    return jsonResponse({
      synced: emailsSynced,
      sends_synced: sendResult.sendsSynced,
      clients_linked: sendResult.clientsLinked,
      last_stat_id: sendResult.lastStatId,
      sync_method: sendResult.syncMethod,
      source: credentials.source,
      full_resync: fullResync,
    })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unknown error', 500)
  }
})
