import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { verifyOperator } from '../_shared/auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const BUCKET = 'whatsapp-media'

function storagePathFromPublicUrl(mediaUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const index = mediaUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(mediaUrl.slice(index + marker.length))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await verifyOperator(req)
    if (!user) return errorResponse('Não autorizado', 401)

    const body = await req.json()
    const conversationId = body.conversation_id as string | undefined
    const messageId = body.message_id as string | undefined

    if (!conversationId) return errorResponse('conversation_id é obrigatório')
    if (!messageId) return errorResponse('message_id é obrigatório')

    const supabase = getSupabaseAdmin()

    const { data: message, error: msgError } = await supabase
      .from('whatsapp_messages')
      .select('id, conversation_id, media_url, body, sent_at')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .single()

    if (msgError || !message) return errorResponse('Mensagem não encontrada', 404)

    if (message.media_url) {
      const storagePath = storagePathFromPublicUrl(message.media_url)
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
        if (storageError) {
          console.error('delete media:', storageError)
        }
      }
    }

    const { error: deleteError } = await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('id', messageId)
      .eq('conversation_id', conversationId)

    if (deleteError) throw deleteError

    const { data: latest } = await supabase
      .from('whatsapp_messages')
      .select('body, sent_at')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_preview: latest?.body?.slice(0, 200) ?? null,
        last_message_at: latest?.sent_at ?? null,
      })
      .eq('id', conversationId)

    return jsonResponse({ ok: true })
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Erro desconhecido', 500)
  }
})
