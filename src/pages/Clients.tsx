import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatPhone, STATUS_LABELS } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, FieldGroup, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import type { Client, ClientStatus } from '@/types/database'

async function fetchClients(search: string, status: string) {
  let query = supabase.from('clients').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
  const { data, error } = await query
  if (error) throw error
  return data as Client[]
}

export function ClientsPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', status: 'lead' as ClientStatus,
    source: '', notes: '', whatsapp_opt_in: true, email_opt_in: true,
  })

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', search, statusFilter],
    queryFn: () => fetchClients(search, statusFilter),
  })

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const payload = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        status: data.status,
        source: data.source || null,
        notes: data.notes || null,
        whatsapp_opt_in: data.whatsapp_opt_in,
        email_opt_in: data.email_opt_in,
      }
      if (data.id) {
        const { error } = await supabase.from('clients').update(payload).eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModalOpen(false)
      setEditing(null)
    },
  })

  const syncMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('mautic-sync-contact', {
        body: { client_id: clientId },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', company: '', status: 'lead', source: '', notes: '', whatsapp_opt_in: true, email_opt_in: true })
    setModalOpen(true)
  }

  const openEdit = (client: Client) => {
    setEditing(client)
    setForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      company: client.company ?? '',
      status: client.status,
      source: client.source ?? '',
      notes: client.notes ?? '',
      whatsapp_opt_in: client.whatsapp_opt_in,
      email_opt_in: client.email_opt_in,
    })
    setModalOpen(true)
  }

  const canEdit = hasPermission('clients_edit')

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-roll-gray-900">Clientes</h1>
          <p className="text-roll-gray-500">{clients.length} clientes cadastrados</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-roll-gray-400" />
            <Input
              className="pl-10"
              placeholder="Buscar por nome, email ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).filter(([k]) => ['lead', 'contacted', 'converted', 'inactive'].includes(k)).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-roll-orange border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-roll-gray-200 text-left text-roll-gray-500">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Telefone</th>
                  <th className="pb-3 font-medium">Empresa</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-roll-gray-100 hover:bg-roll-gray-50">
                    <td className="py-3">
                      <Link to={`/clientes/${client.id}`} className="font-medium text-roll-orange hover:underline">
                        {client.name}
                      </Link>
                    </td>
                    <td className="py-3 text-roll-gray-600">{client.email ?? '—'}</td>
                    <td className="py-3 text-roll-gray-600">{formatPhone(client.phone)}</td>
                    <td className="py-3 text-roll-gray-600">{client.company ?? '—'}</td>
                    <td className="py-3">
                      <Badge status={client.status} label={STATUS_LABELS[client.status]} />
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>Editar</Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={syncMutation.isPending}
                              onClick={() => syncMutation.mutate(client.id)}
                            >
                              <RefreshCw className="h-3 w-3" /> Email
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-roll-gray-400">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ ...form, id: editing?.id }) }}>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Nome *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </FieldGroup>
            <FieldGroup label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FieldGroup>
            <FieldGroup label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" />
            </FieldGroup>
            <FieldGroup label="Empresa">
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </FieldGroup>
            <FieldGroup label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}>
                <option value="lead">Lead</option>
                <option value="contacted">Contatado</option>
                <option value="converted">Convertido</option>
                <option value="inactive">Inativo</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="Origem">
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </FieldGroup>
          </div>
          <FieldGroup label="Observações">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </FieldGroup>
          <div className="mb-4 flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.email_opt_in} onChange={(e) => setForm({ ...form, email_opt_in: e.target.checked })} />
              Opt-in Email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.whatsapp_opt_in} onChange={(e) => setForm({ ...form, whatsapp_opt_in: e.target.checked })} />
              Opt-in WhatsApp
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saveMutation.isPending}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
