export interface ConversationNote {
  id: string
  text: string
  createdAt: string
}

function newNoteId(): string {
  return crypto.randomUUID()
}

export function parseConversationNotes(raw: string | null | undefined): ConversationNote[] {
  if (!raw?.trim()) return []

  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter(
          (item): item is ConversationNote =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as ConversationNote).id === 'string' &&
            typeof (item as ConversationNote).text === 'string' &&
            typeof (item as ConversationNote).createdAt === 'string',
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } catch {
      return []
    }
  }

  return [
    {
      id: 'legacy',
      text: trimmed,
      createdAt: new Date(0).toISOString(),
    },
  ]
}

export function serializeConversationNotes(notes: ConversationNote[]): string {
  return JSON.stringify(
    [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
}

export function appendConversationNote(raw: string | null | undefined, text: string): string {
  const notes = parseConversationNotes(raw)
  const next: ConversationNote = {
    id: newNoteId(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }
  return serializeConversationNotes([next, ...notes])
}

export function removeConversationNote(raw: string | null | undefined, noteId: string): string {
  const notes = parseConversationNotes(raw).filter((note) => note.id !== noteId)
  if (notes.length === 0) return ''
  return serializeConversationNotes(notes)
}

export function getLatestConversationNote(raw: string | null | undefined): ConversationNote | null {
  const notes = parseConversationNotes(raw)
  return notes[0] ?? null
}

export function formatNoteDate(iso: string): string {
  if (iso === new Date(0).toISOString()) return ''
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}
