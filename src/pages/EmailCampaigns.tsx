import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { extractDayNumber, syncEmailsFromMautic } from '@/lib/emails-mautic'
import { calculateOpenRate, formatDateOnly, formatNumber } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input, Label, Select } from '@/components/ui/Input'
import type { MauticEmail } from '@/types/database'

type SortOption =
  | 'day-desc'
  | 'day-asc'
  | 'date-desc'
  | 'date-asc'
  | 'open-rate-desc'
  | 'open-rate-asc'
  | 'sent-desc'
  | 'sent-asc'
  | 'name-asc'
  | 'name-desc'

type StatusFilter = 'all' | 'published' | 'draft'

async function fetchMauticEmails() {
  const { data, error } = await supabase
    .from('emails_mautic')
    .select('id, nome, assunto, segmento, enviados, abertos, publicado, criado_em, synced_at')

  if (error) throw error
  return (data ?? []) as MauticEmail[]
}

function getEmailTimestamp(email: MauticEmail): number {
  return email.criado_em ? new Date(email.criado_em).getTime() : 0
}

function getEmailDayNumber(email: MauticEmail): number {
  return extractDayNumber(email.nome, email.segmento) ?? 0
}

function sortEmails(emails: MauticEmail[], sortBy: SortOption): MauticEmail[] {
  const sorted = [...emails]

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'day-desc':
        return getEmailDayNumber(b) - getEmailDayNumber(a)
      case 'day-asc':
        return getEmailDayNumber(a) - getEmailDayNumber(b)
      case 'date-desc':
        return getEmailTimestamp(b) - getEmailTimestamp(a)
      case 'date-asc':
        return getEmailTimestamp(a) - getEmailTimestamp(b)
      case 'open-rate-desc':
        return calculateOpenRate(b.abertos ?? 0, b.enviados ?? 0)
          - calculateOpenRate(a.abertos ?? 0, a.enviados ?? 0)
      case 'open-rate-asc':
        return calculateOpenRate(a.abertos ?? 0, a.enviados ?? 0)
          - calculateOpenRate(b.abertos ?? 0, b.enviados ?? 0)
      case 'sent-desc':
        return (b.enviados ?? 0) - (a.enviados ?? 0)
      case 'sent-asc':
        return (a.enviados ?? 0) - (b.enviados ?? 0)
      case 'name-asc':
        return a.nome.localeCompare(b.nome, 'pt-BR')
      case 'name-desc':
        return b.nome.localeCompare(a.nome, 'pt-BR')
      default:
        return 0
    }
  })

  return sorted
}

function filterEmails(
  emails: MauticEmail[],
  statusFilter: StatusFilter,
  search: string,
): MauticEmail[] {
  const term = search.trim().toLowerCase()

  return emails.filter((email) => {
    if (statusFilter === 'published' && !email.publicado) return false
    if (statusFilter === 'draft' && email.publicado) return false

    if (!term) return true

    const haystack = [email.nome, email.assunto, email.segmento]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(term)
  })
}

export function EmailCampaignsPage() {
  const queryClient = useQueryClient()
  const [sortBy, setSortBy] = useState<SortOption>('day-desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const lastSyncRef = useRef(0)

  const { data: emails = [], isLoading, error } = useQuery({
    queryKey: ['emails-mautic'],
    queryFn: fetchMauticEmails,
  })

  const syncMutation = useMutation({
    mutationFn: () => syncEmailsFromMautic(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails-mautic'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['email-channel-clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  useEffect(() => {
    const now = Date.now()
    if (now - lastSyncRef.current < 5 * 60 * 1000) return
    lastSyncRef.current = now
    syncMutation.mutate()
  }, [])

  const displayedEmails = useMemo(() => {
    const filtered = filterEmails(emails, statusFilter, search)
    return sortEmails(filtered, sortBy)
  }, [emails, sortBy, statusFilter, search])

  return (
    <div>
      {syncMutation.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {syncMutation.error instanceof Error
            ? syncMutation.error.message
            : 'Falha ao atualizar os emails'}
        </div>
      )}

      {syncMutation.isSuccess && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Sincronização concluída. {syncMutation.data?.synced ?? 0} email(s) e{' '}
          {syncMutation.data?.sends_synced ?? 0} envio(s) importados do Mautic.
        </div>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label htmlFor="email-search">Buscar</Label>
            <Input
              id="email-search"
              placeholder="Nome, assunto ou segmento..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email-sort">Ordenar por</Label>
            <Select
              id="email-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
            >
              <option value="day-desc">Dia do disparo (decrescente)</option>
              <option value="day-asc">Dia do disparo (crescente)</option>
              <option value="date-desc">Data do disparo (mais recente)</option>
              <option value="date-asc">Data do disparo (mais antiga)</option>
              <option value="open-rate-desc">Taxa de abertura (maior)</option>
              <option value="open-rate-asc">Taxa de abertura (menor)</option>
              <option value="sent-desc">Enviados (maior)</option>
              <option value="sent-asc">Enviados (menor)</option>
              <option value="name-asc">Nome (A → Z)</option>
              <option value="name-desc">Nome (Z → A)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="email-status">Status</Label>
            <Select
              id="email-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Todos</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
            </Select>
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm text-roll-gray-500">
              Exibindo <span className="font-semibold text-roll-gray-800">{displayedEmails.length}</span> de{' '}
              <span className="font-semibold text-roll-gray-800">{emails.length}</span> email(s)
            </p>
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-roll-gray-300 bg-white text-roll-gray-600 transition-colors hover:border-roll-orange hover:bg-roll-orange/5 hover:text-roll-orange disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Atualizar emails"
              title="Atualizar emails"
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-red-600">
            Não foi possível carregar os emails. Verifique a conexão com o Supabase.
          </p>
        ) : (
          <div className="space-y-4">
            {displayedEmails.map((email, index) => {
              const openRate = calculateOpenRate(email.abertos ?? 0, email.enviados ?? 0)
              const dayNumber = extractDayNumber(email.nome, email.segmento)
              return (
                <div
                  key={email.id ?? `${email.nome}-${index}`}
                  className="flex flex-col gap-3 rounded-lg border border-roll-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-roll-gray-900">{email.nome}</h3>
                    <p className="mt-1 text-sm text-roll-gray-500">{email.assunto}</p>
                    {email.segmento && (
                      <p className="mt-1 text-xs text-roll-gray-400">Segmento: {email.segmento}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-roll-gray-400">
                      {dayNumber !== null && <span>Dia {dayNumber}</span>}
                      {email.criado_em && (
                        <span>Disparo: {formatDateOnly(email.criado_em)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 sm:gap-6">
                    <div className="text-right">
                      <p className="text-xs text-roll-gray-400">Enviados</p>
                      <p className="text-lg font-semibold text-roll-gray-500">
                        {formatNumber(email.enviados ?? 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-roll-gray-400">Taxa de abertura</p>
                      <p className="text-lg font-semibold text-roll-orange">{openRate}%</p>
                    </div>
                    {email.publicado !== null && email.publicado !== undefined && (
                      <Badge
                        status={email.publicado ? 'completed' : 'draft'}
                        label={email.publicado ? 'Publicado' : 'Rascunho'}
                      />
                    )}
                  </div>
                </div>
              )
            })}
            {emails.length === 0 && (
              <p className="py-8 text-center text-roll-gray-400">
                Nenhum email encontrado. A sincronização com o Mautic roda automaticamente ao abrir esta página.
              </p>
            )}
            {emails.length > 0 && displayedEmails.length === 0 && (
              <p className="py-8 text-center text-roll-gray-400">
                Nenhum email corresponde aos filtros selecionados.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
