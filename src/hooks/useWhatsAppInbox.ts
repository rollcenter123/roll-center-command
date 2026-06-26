import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Client, WhatsAppConversation, WhatsAppMessage } from '@/types/database'

export function useWhatsAppInbox() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkedClient, setLinkedClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

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
      setMessages(data ?? [])
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

      const message = data?.message as WhatsAppMessage | undefined
      if (message && message.conversation_id === selectedId) {
        setMessages((prev) => {
          if (prev.some((row) => row.id === message.id)) return prev
          return [...prev, message]
        })
      }

      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao enviar mensagem'
      setSendError(msg)
      return false
    } finally {
      setSending(false)
    }
  }, [selectedId])

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
    reloadConversations: loadConversations,
  }
}
