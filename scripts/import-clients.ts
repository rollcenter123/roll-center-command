import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

config({ path: resolve(import.meta.dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

const COLUMN_MAP: Record<string, string> = {
  nome: 'name', name: 'name', cliente: 'name',
  email: 'email', 'e-mail': 'email',
  telefone: 'phone', phone: 'phone', celular: 'phone', whatsapp: 'phone',
  empresa: 'company', company: 'company',
  status: 'status', origem: 'source', source: 'source',
  observacoes: 'notes', observações: 'notes', notes: 'notes',
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

function mapRow(raw: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.toLowerCase().trim()
    const field = COLUMN_MAP[normalized]
    if (field) mapped[field] = value
    else if (value !== null && value !== undefined && value !== '') custom[key] = value
  }

  const name = String(mapped.name ?? '').trim()
  if (!name) return null

  return {
    name,
    email: mapped.email ? String(mapped.email).trim() : null,
    phone: mapped.phone ? normalizePhone(String(mapped.phone)) : null,
    company: mapped.company ? String(mapped.company).trim() : null,
    status: mapped.status ? String(mapped.status).toLowerCase() : 'lead',
    source: mapped.source ? String(mapped.source).trim() : null,
    notes: mapped.notes ? String(mapped.notes).trim() : null,
    custom_fields: custom,
  }
}

async function main() {
  const filePath = process.argv[2] ?? resolve(import.meta.dirname, '../data/clientes.xlsx')

  if (!existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`)
    console.log('Uso: npx tsx scripts/import-clients.ts [caminho/planilha.xlsx]')
    process.exit(1)
  }

  console.log(`Lendo: ${filePath}`)
  const buffer = readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const clients = rows.map(mapRow).filter(Boolean)

  console.log(`${clients.length} registros encontrados`)

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const client of clients) {
    try {
      if (client!.email) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('email', client!.email)
          .single()

        if (existing) {
          await supabase.from('clients').update(client!).eq('id', existing.id)
          imported++
          continue
        }
      }

      if (client!.phone) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', client!.phone)
          .single()

        if (existing) {
          skipped++
          continue
        }
      }

      const { error } = await supabase.from('clients').insert(client!)
      if (error) throw error
      imported++
    } catch (e) {
      errors.push(`${client!.name}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  console.log(`\nResultado:`)
  console.log(`  Importados: ${imported}`)
  console.log(`  Ignorados:  ${skipped}`)
  console.log(`  Erros:      ${errors.length}`)
  if (errors.length) errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`))
}

main()
