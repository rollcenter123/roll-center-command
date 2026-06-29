import * as XLSX from 'xlsx'
import { normalizePhone } from '@/lib/utils'
import type { ClientStatus } from '@/types/database'

export const IMPORT_COLUMN_MAP: Record<string, string> = {
  nome: 'name',
  name: 'name',
  cliente: 'name',
  email: 'email',
  'e-mail': 'email',
  telefone: 'phone',
  phone: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  empresa: 'company',
  company: 'company',
  status: 'status',
  origem: 'source',
  source: 'source',
  observacoes: 'notes',
  observações: 'notes',
  notes: 'notes',
}

export interface ImportClientRow {
  name: string
  email?: string
  phone?: string
  company?: string
  status?: ClientStatus
  source?: string
  notes?: string
  custom_fields: Record<string, unknown>
}

export function mapImportRow(raw: Record<string, unknown>): ImportClientRow | null {
  const mapped: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.toLowerCase().trim()
    const field = IMPORT_COLUMN_MAP[normalized]
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

export async function parseClientsSpreadsheet(file: File): Promise<ImportClientRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  return rows.map(mapImportRow).filter((row): row is ImportClientRow => row !== null)
}

export interface ImportClientsResult {
  imported: number
  skipped: number
  errors: string[]
}
