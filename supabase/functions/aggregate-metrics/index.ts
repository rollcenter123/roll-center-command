import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const channels = ['email', 'whatsapp', 'clients'] as const

    for (const channel of channels) {
      if (channel === 'clients') {
        const { count } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${yesterday}T00:00:00`)

        await supabase.from('daily_metrics').upsert({
          date: yesterday,
          channel: 'clients',
          new_clients: count ?? 0,
        }, { onConflict: 'date,channel' })
        continue
      }

      const { data: events } = await supabase
        .from('campaign_events')
        .select('event_type')
        .eq('channel', channel)
        .gte('occurred_at', `${yesterday}T00:00:00`)
        .lt('occurred_at', `${today}T00:00:00`)

      const counts: Record<string, number> = {}
      for (const e of events ?? []) {
        counts[e.event_type] = (counts[e.event_type] ?? 0) + 1
      }

      await supabase.from('daily_metrics').upsert({
        date: yesterday,
        channel,
        sent: counts.sent ?? 0,
        delivered: counts.delivered ?? 0,
        opened: counts.opened ?? 0,
        clicked: counts.clicked ?? 0,
        read_count: counts.read ?? 0,
        replied: counts.replied ?? 0,
        failed: counts.failed ?? 0,
      }, { onConflict: 'date,channel' })
    }

    return jsonResponse({ aggregated: true, date: yesterday })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'error' }, 500)
  }
})
