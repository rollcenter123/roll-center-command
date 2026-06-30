import { useCallback, useEffect, useRef, useState } from 'react'
import { parseFetchMediaResponse } from '@/lib/whatsapp-media-client'
import { supabase } from '@/lib/supabase'
import type { Client, WhatsAppConversation, WhatsAppMessage } from '@/types/database'
import { needsMediaFetch } from '@/lib/whatsapp-message-media'

export function useWhatsAppInbox() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkedClient, setLinkedClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const fetchingMediaRef = useRef(new Map<string, Promise<string | null>>())
  const attemptedMediaRef = useRef(new Set<string>())

  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('whatsapp_conversations:', error)
      return
    }

    setConversations(data ?? [])
    setSelectedId((current) => {
      if (current && data?.some((row) => row.id === current)) return current
      return data?.[0]?.id ?? null
    })
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true)
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })

    if (error) {
      console.error('whatsapp_messages:', error)
    } else {
      const rows = (data ?? []).map((row) => ({
        ...row,
        media_url: row.media_url ?? null,
        media_mime_type: row.media_mime_type ?? null,
      }))
      setMessages(rows)
    }
    setMessagesLoading(false)
  }, [])

  const markConversationRead = useCallback(async (conversationId: string) => {
    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)

    setConversations((prev) =>
      prev.map((row) => (row.id === conversationId ? { ...row, unread_count: 0 } : row)),
    )
  }, [])

  const selectConversation = useCallback(
    async (conversationId: string) => {
      setSelectedId(conversationId)
      await markConversationRead(conversationId)
    },
    [markConversationRead],
  )

  const updateConversation = useCallback(
    async (conversationId: string, patch: Partial<WhatsAppConversation>) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update(patch)
        .eq('id', conversationId)

      if (error) {
        console.error('update conversation:', error)
        return
      }

      setConversations((prev) =>
        prev.map((row) => (row.id === conversationId ? { ...row, ...patch } : row)),
      )
    },
    [],
  )

  const appendOutboundMessage = useCallback((message: WhatsAppMessage | undefined) => {
    if (message && message.conversation_id === selectedId) {
      setMessages((prev) => {
        if (prev.some((row) => row.id === message.id)) return prev
        return [...prev, message]
      })
    }
  }, [selectedId])

  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return false

    setSending(true)
    setSendError(null)

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: { conversation_id: conversationId, text: trimmed },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error as string)

      appendOutboundMessage(data?.message as WhatsAppMessage | undefined)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao enviar mensagem'
      setSendError(msg)
      return false
    } finally {
      setSending(false)
    }
  }, [appendOutboundMessage])

  const sendImage = useCallback(async (
    conversationId: string,
    file: File,
    caption?: string,
  ) => {
    setSending(true)
    setSendError(null)

    try {
      const allowed = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(file.type)) {
        throw new Error('Use uma imagem JPG, PNG ou WebP.')
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Imagem muito grande. Máximo 5 MB.')
      }

      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i])
      }
      const imageBase64 = btoa(binary)

      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          conversation_id: conversationId,
          image_base64: imageBase64,
          mime_type: file.type,
          caption: caption?.trim() || undefined,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error as string)

      appendOutboundMessage(data?.message as WhatsAppMessage | undefined)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao enviar imagem'
      setSendError(msg)
      return false
    } finally {
      setSending(false)
    }
  }, [appendOutboundMessage])

  const sendAudio = useCallback(async (
    conversationId: string,
    blob: Blob,
    mimeType: string,
  ) => {
    setSending(true)
    setSendError(null)

    try {
      if (blob.size > 16 * 1024 * 1024) {
        throw new Error('Áudio muito grande. Máximo 16 MB.')
      }

      const buffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i])
      }
      const audioBase64 = btoa(binary)

      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          conversation_id: conversationId,
          audio_base64: audioBase64,
          mime_type: mimeType,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error as string)

      appendOutboundMessage(data?.message as WhatsAppMessage | undefined)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao enviar áudio'
      setSendError(msg)
      return false
    } finally {
      setSending(false)
    }
  }, [appendOutboundMessage])

  const fetchMessageMedia = useCallback(async (messageId: string): Promise<string | null> => {
    const inFlight = fetchingMediaRef.current.get(messageId)
    if (inFlight) return inFlight

    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('whatsapp-fetch-media', {
          body: { message_id: messageId },
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error as string)

        const { mediaUrl } = parseFetchMediaResponse(data as {
          media_url?: string
          media_base64?: string
          mime_type?: string
          error?: string
        })

        if (mediaUrl) {
          setMessages((prev) =>
            prev.map((row) => (row.id === messageId ? { ...row, media_url: mediaUrl } : row)),
          )
        }
        return mediaUrl
      } catch (e) {
        console.error('fetch media:', e)
        return null
      }
    })()

    fetchingMediaRef.current.set(messageId, promise)
    try {
      return await promise
    } finally {
      fetchingMediaRef.current.delete(messageId)
    }
  }, [])

  const reactToMessage = useCallback(async (
    conversationId: string,
    messageId: string,
    emoji: string,
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-react-message', {
        body: {
          conversation_id: conversationId,
          message_id: messageId,
          emoji,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error as string)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao enviar reação'
      setSendError(msg)
      return false
    }
  }, [])

  useEffect(() => {
    setSendError(null)
  }, [selectedId])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await loadConversations()
      setLoading(false)
    })()
  }, [loadConversations])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      setLinkedClient(null)
      return
    }

    void loadMessages(selectedId)

    const conversation = conversations.find((row) => row.id === selectedId)
    if (!conversation?.client_id) {
      setLinkedClient(null)
      return
    }

    void (async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', conversation.client_id)
        .maybeSingle()
      setLinkedClient(data)
    })()
  }, [selectedId, loadMessages, conversations])

  useEffect(() => {
    if (!messages.length) return

    for (const message of messages) {
      if (!needsMediaFetch(message)) continue
      if (attemptedMediaRef.current.has(message.id)) continue
      attemptedMediaRef.current.add(message.id)
      void fetchMessageMedia(message.id)
    }
  }, [messages, fetchMessageMedia])

  useEffect(() => {
    attemptedMediaRef.current.clear()
  }, [selectedId])

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-inbox')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const row = payload.new as WhatsAppMessage
          if (row.conversation_id === selectedId) {
            setMessages((prev) => {
              if (prev.some((message) => message.id === row.id)) return prev
              return [...prev, row]
            })
            void markConversationRead(row.conversation_id)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const row = payload.new as WhatsAppMessage
          if (row.conversation_id === selectedId) {
            setMessages((prev) =>
              prev.map((message) => (message.id === row.id ? row : message)),
            )
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          void loadConversations()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' },
        (payload) => {
          const row = payload.new as WhatsAppConversation
          setConversations((prev) => {
            const next = prev.map((item) => (item.id === row.id ? row : item))
            return [...next].sort((a, b) => {
              const aTime = a.last_message_at ?? ''
              const bTime = b.last_message_at ?? ''
              return bTime.localeCompare(aTime)
            })
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedId, loadConversations, markConversationRead])

  return {
    conversations,
    messages,
    selectedId,
    linkedClient,
    loading,
    messagesLoading,
    sending,
    sendError,
    selectConversation,
    updateConversation,
    sendMessage,
    sendImage,
    sendAudio,
    fetchMessageMedia,
    reactToMessage,
    reloadConversations: loadConversations,
  }
}
