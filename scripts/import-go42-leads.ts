import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import {
  GO42_DEFAULT_FUNNEL,
  mapGo42ImportRow,
  type Go42ImportRow,
} from '../src/lib/go42-import.ts'

config({ path: resolve(import.meta.dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

type StageLookup = Map<string, Map<string, string>>

const GO42_FUNNELS = ['Disparo Base', 'Disparos Felipe', 'Disparos Luis Gustavo', 'Disparo Gerencia'] as const

const GO42_STAGES = [
  { name: 'Disparado', position: 0, color: '#3b82f6' },
  { name: 'Respondeu', position: 1, color: '#f97316' },
  { name: 'Cotou', position: 2, color: '#22c55e' },
  { name: 'Não Quer', position: 3, color: '#ef4444' },
  { name: 'Não Existe/Mudou', position: 4, color: '#8b5cf6' },
] as const

async function ensureGo42CrmStructure(): Promise<void> {
  const { data: existingFunnels, error: listError } = await supabase
    .from('whatsapp_funnels')
    .select('id, name')

  if (listError) {
    if (listError.message.includes('whatsapp_funnels')) {
      console.error('\n⚠ Execute a migration 007_whatsapp_crm_funnels.sql no painel do Supabase (SQL Editor).')
      console.error('  Arquivo: supabase/migrations/007_whatsapp_crm_funnels.sql\n')
    }
    throw listError
  }

  const funnelNames = new Set((existingFunnels ?? []).map((f) => f.name))
  let position = 0

  for (const funnelName of GO42_FUNNELS) {
    if (funnelNames.has(funnelName)) {
      position++
      continue
    }

    const { data: created, error } = await supabase
      .from('whatsapp_funnels')
      .insert({ name: funnelName, position })
      .select('id')
      .single()

    if (error) throw error

    for (const stage of GO42_STAGES) {
      const { error: stageError } = await supabase.from('whatsapp_stages').insert({
        funnel_id: created.id,
        ...stage,
      })
      if (stageError) throw stageError
    }

    console.log(`  Funil criado: ${funnelName}`)
    position++
  }
}

async function loadStageLookup(): Promise<{ stages: StageLookup }> {
  const { data: funnels, error: funnelsError } = await supabase
    .from('whatsapp_funnels')
    .select('id, name')

  if (funnelsError) {
    if (funnelsError.message.includes('whatsapp_funnels')) {
      throw new Error(
        'Tabela whatsapp_funnels não existe. Execute a migration 007_whatsapp_crm_funnels.sql no Supabase.',
      )
    }
    throw funnelsError
  }

  const { data: stages, error: stagesError } = await supabase
    .from('whatsapp_stages')
    .select('id, name, funnel_id')

  if (stagesError) throw stagesError

  const funnelIdToName = new Map<string, string>()
  for (const funnel of funnels ?? []) {
    funnelIdToName.set(funnel.id, funnel.name.toLowerCase())
  }

  const stageLookup: StageLookup = new Map()
  for (const stage of stages ?? []) {
    const funnelName = funnelIdToName.get(stage.funnel_id)
    if (!funnelName) continue
    if (!stageLookup.has(funnelName)) stageLookup.set(funnelName, new Map())
    stageLookup.get(funnelName)!.set(stage.name.toLowerCase(), stage.id)
  }

  return { stages: stageLookup }
}

function resolveStageId(row: Go42ImportRow, lookup: { stages: StageLookup }): string | null {
  const funnelName = row.crmFunnel.toLowerCase()
  const stageName = row.crmStage?.toLowerCase()
  if (!stageName) return null

  const funnelStages = lookup.stages.get(funnelName)
  if (!funnelStages) {
    const defaultStages = lookup.stages.get(GO42_DEFAULT_FUNNEL.toLowerCase())
    return defaultStages?.get(stageName) ?? null
  }

  return funnelStages.get(stageName) ?? null
}

async function upsertClient(row: Go42ImportRow, stageId: string | null) {
  const phone = row.phone ? normalizePhone(row.phone) : null
  const payload = {
    name: row.name,
    phone,
    source: row.source ?? 'go42',
    notes: row.notes,
    tags: row.tags,
    custom_fields: row.custom_fields,
    whatsapp_stage_id: stageId,
    whatsapp_opt_in: true,
    email_opt_in: true,
    status: 'lead' as const,
  }

  if (phone) {
    const { data: existing } = await supabase.from('clients').select('id').eq('phone', phone).maybeSingle()
    if (existing) {
      const { error } = await supabase.from('clients').update(payload).eq('id', existing.id)
      if (error) throw error
      return 'updated' as const
    }
  }

  const { error } = await supabase.from('clients').insert(payload)
  if (error) throw error
  return 'inserted' as const
}

async function main() {
  const filePath = process.argv[2] ?? resolve(import.meta.dirname, '../data/leads_export.xlsx')
  const dryRun = process.argv.includes('--dry-run')

  if (!existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`)
    console.log('Uso: npx tsx scripts/import-go42-leads.ts [planilha.xlsx] [--dry-run]')
    process.exit(1)
  }

  console.log(`Lendo: ${filePath}`)
  const buffer = readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const rows = rawRows.map(mapGo42ImportRow).filter(Boolean) as Go42ImportRow[]

  console.log(`${rows.length} leads válidos de ${rawRows.length} linhas`)

  const stageCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.crmStage ?? '(sem etapa)'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  console.log('\nDistribuição por etapa (Go42):')
  Object.entries(stageCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([stage, count]) => console.log(`  ${stage}: ${count}`))

  const funnelCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.crmFunnel] = (acc[row.crmFunnel] ?? 0) + 1
    return acc
  }, {})
  console.log('\nDistribuição por funil (mapeamento):')
  Object.entries(funnelCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([funnel, count]) => console.log(`  ${funnel}: ${count}`))

  console.log(`\nFunil padrão: ${GO42_DEFAULT_FUNNEL}`)
  console.log('Verificando funis e etapas do CRM...')
  await ensureGo42CrmStructure()
  const lookup = await loadStageLookup()

  let inserted = 0
  let updated = 0
  let noStage = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const stageId = resolveStageId(row, lookup)
      if (!stageId) {
        noStage++
        if (noStage <= 5) {
          errors.push(`${row.name}: etapa "${row.crmStage}" não encontrada no funil`)
        }
        continue
      }

      if (dryRun) {
        inserted++
        continue
      }

      const result = await upsertClient(row, stageId)
      if (result === 'updated') updated++
      else inserted++
    } catch (e) {
      errors.push(`${row.name}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  console.log(`\nResultado${dryRun ? ' (simulação)' : ''}:`)
  console.log(`  Novos:        ${inserted}`)
  console.log(`  Atualizados:  ${updated}`)
  console.log(`  Sem etapa:    ${noStage}`)
  console.log(`  Erros:        ${errors.length}`)
  if (errors.length) errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`))
}

main()
