import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { ClientStatus } from '@/types/database'

const COLUMN_MAP: Record<string, string> = {
  nome: 'name', name: 'name', cliente: 'name',
  email: 'email', 'e-mail': 'email',
  telefone: 'phone', phone: 'phone', celular: 'phone', whatsapp: 'phone',
  empresa: 'company', company: 'company',
  status: 'status', origem: 'source', source: 'source',
  observacoes: 'notes', observações: 'notes', notes: 'notes',
}

interface ImportRow {
  name: string
  email?: string
  phone?: string
  company?: string
  status?: ClientStatus
  source?: string
  notes?: string
  custom_fields: Record<string, unknown>
}

function mapRow(raw: Record<string, unknown>): ImportRow | null {
  const mapped: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.toLowerCase().trim()
    const field = COLUMN_MAP[normalized]
    if (field) {
      mapped[field] = value
    } else if (value !== null && value !== undefined && value !== '') {
      custom[key] = value
    }
  }

  const name = String(mapped.name ?? '').trim()
  if (!name) return null

  let status = String(mapped.status ?? 'lead').toLowerCase() as ClientStatus
  if (!['lead', 'contacted', 'converted', 'inactive'].includes(status)) status = 'lead'

  return {
    name,
    email: mapped.email ? String(mapped.email).trim() : undefined,
    phone: mapped.phone ? normalizePhone(String(mapped.phone)) : undefined,
    company: mapped.company ? String(mapped.company).trim() : undefined,
    status,
    source: mapped.source ? String(mapped.source).trim() : undefined,
    notes: mapped.notes ? String(mapped.notes).trim() : undefined,
    custom_fields: custom,
  }
}

export function ImportClientsPage() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportRow[]>([])
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  const parseFile = useCallback(async (f: File) => {
    const buffer = await f.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    const mapped = rows.map(mapRow).filter((r): r is ImportRow => r !== null)
    setPreview(mapped.slice(0, 10))
    return mapped
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) {
      setFile(f)
      await parseFile(f)
    }
  }, [parseFile])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      await parseFile(f)
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Nenhum arquivo selecionado')
      const rows = await parseFile(file)
      const { data, error } = await supabase.functions.invoke('import-clients', {
        body: { clients: rows },
      })
      if (error) throw error
      return data as { imported: number; skipped: number; errors: string[] }
    },
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-roll-gray-900">Importar Clientes</h1>
        <p className="text-roll-gray-500">Importe clientes de planilha Excel (.xlsx) ou CSV</p>
      </div>

      <Card className="mb-6">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-roll-gray-300 bg-roll-gray-50 p-12 transition-colors hover:border-roll-orange"
        >
          <Upload className="mb-4 h-12 w-12 text-roll-gray-400" />
          <p className="mb-2 text-lg font-medium text-roll-gray-700">
            Arraste sua planilha aqui
          </p>
          <p className="mb-4 text-sm text-roll-gray-400">ou clique para selecionar</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-roll-gray-300 px-4 py-2 text-sm font-medium text-roll-gray-700 transition-colors hover:bg-roll-gray-50">
            Selecionar Arquivo
          </label>
          {file && (
            <p className="mt-4 flex items-center gap-2 text-sm text-roll-gray-600">
              <FileSpreadsheet className="h-4 w-4" />
              {file.name} — {preview.length > 0 ? `${preview.length}+ registros detectados` : 'processando...'}
            </p>
          )}
        </div>
      </Card>

      {preview.length > 0 && (
        <Card title="Pré-visualização (10 primeiros)" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-roll-gray-500">
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Telefone</th>
                  <th className="pb-2">Empresa</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-roll-gray-100">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{row.email ?? '—'}</td>
                    <td className="py-2">{row.phone ?? '—'}</td>
                    <td className="py-2">{row.company ?? '—'}</td>
                    <td className="py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending}>
              Importar Clientes
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card title="Resultado da Importação">
          <div className="space-y-2 text-sm">
            <p className="text-green-600">✓ {result.imported} clientes importados</p>
            <p className="text-roll-gray-500">{result.skipped} ignorados (duplicatas)</p>
            {result.errors.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-red-600">Erros:</p>
                <ul className="mt-2 list-disc pl-5 text-red-500">
                  {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Colunas suportadas" className="mt-6">
        <p className="text-sm text-roll-gray-600">
          Nome, Email, Telefone, Empresa, Status (lead/contatado/convertido/inativo), Origem, Observações.
          Colunas extras serão salvas em campos personalizados.
        </p>
      </Card>
    </div>
  )
}
