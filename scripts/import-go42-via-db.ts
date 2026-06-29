/**
 * Importa leads Go42 via Supabase CLI (sem service role key no .env).
 * Uso: npx tsx scripts/import-go42-via-db.ts [planilha.xlsx] [--dry-run]
 */
import * as XLSX from 'xlsx'
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { mapGo42ImportRow, type Go42ImportRow } from '../src/lib/go42-import.ts'

const PROJECT_DIR = resolve(import.meta.dirname, '..')

const STAGE_IDS: Record<string, string> = {
  Disparado: '77e0a7aa-ec14-48e6-b6a1-8d5d4b11ee93', // Novos
  Respondeu: '251db558-09fe-4c8f-90aa-2805840bdb90', // Em conversa
  Cotou: '87cc3a6a-cb64-4cf4-94ed-be3aa7199d9c', // Cotação
  'Não Quer': '2354c4d1-3de7-4dab-9e56-ff0d67184da7',
  'Não Existe/Mudou': '43ee36d6-b817-44cb-8c64-fe966ad9ef5a', // Cotação feita
}

const ASSIGNED_PROFILE: Record<string, { profileId: string; funnel: string }> = {
  'd4cac14e-5abf-4765-aec6-94cf6df0320d': {
    profileId: '1b5c9043-b2cd-4e9c-b693-ef13bdf6ac33',
    funnel: 'Disparos Felipe',
  },
  '74c4dae8-3726-47ca-8c6a-7c3bd48cbf82': {
    profileId: 'f412e694-56a7-40a5-aadd-c8bf6a59f7d7',
    funnel: 'Disparos Luis Gustavo',
  },
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

function sqlString(value: string | null | undefined): string {
  if (value == null || value === '') return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

function sqlJson(value: Record<string, unknown>): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
}

function resolveStageId(row: Go42ImportRow): string | null {
  if (!row.crmStage) return null
  return STAGE_IDS[row.crmStage] ?? null
}

function buildAssignment(row: Go42ImportRow) {
  const member = row.teamMemberId ? ASSIGNED_PROFILE[row.teamMemberId] : null
  return {
    assigned_profile_id: member?.profileId ?? null,
    crm_funnel: row.crmFunnel,
    go42_member_id: row.teamMemberId,
    go42_stage: row.crmStage,
  }
}

function buildUpsertSql(row: Go42ImportRow): string | null {
  const phone = row.phone ? normalizePhone(row.phone) : null
  if (!phone) return null

  const stageId = resolveStageId(row)
  if (!stageId) return null

  const assignment = buildAssignment(row)
  const customFields = { ...row.custom_fields, ...assignment }
  const tags = row.tags.length ? `ARRAY[${row.tags.map((t) => sqlString(t)).join(', ')}]::text[]` : `'{}'::text[]`

  return `
INSERT INTO clients (name, phone, source, notes, tags, custom_fields, whatsapp_stage_id, status, whatsapp_opt_in, email_opt_in)
VALUES (
  ${sqlString(row.name)},
  ${sqlString(phone)},
  ${sqlString(row.source ?? 'go42')},
  ${sqlString(row.notes)},
  ${tags},
  ${sqlJson(customFields)},
  ${sqlString(stageId)},
  'lead',
  true,
  true
)
ON CONFLICT (phone) WHERE phone IS NOT NULL DO UPDATE SET
  name = EXCLUDED.name,
  source = EXCLUDED.source,
  notes = EXCLUDED.notes,
  tags = EXCLUDED.tags,
  custom_fields = EXCLUDED.custom_fields,
  whatsapp_stage_id = EXCLUDED.whatsapp_stage_id,
  updated_at = NOW();`.trim()
}

function runSql(sql: string) {
  const tempFile = join(PROJECT_DIR, '.tmp-import-batch.sql')
  writeFileSync(tempFile, sql, 'utf8')
  try {
    execSync(`npx supabase db query --linked -f "${tempFile}"`, {
      cwd: PROJECT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
  } finally {
    unlinkSync(tempFile)
  }
}

async function main() {
  const filePath = process.argv[2] ?? 'c:/Users/Will/Downloads/leads_export_todos_20260629_120245.xlsx'
  const dryRun = process.argv.includes('--dry-run')
  const batchSize = 40

  if (!existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`)
    process.exit(1)
  }

  const buffer = readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const rows = rawRows.map(mapGo42ImportRow).filter(Boolean) as Go42ImportRow[]

  const statements = rows.map(buildUpsertSql).filter(Boolean) as string[]
  const skipped = rows.length - statements.length

  const funnelCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.crmFunnel] = (acc[row.crmFunnel] ?? 0) + 1
    return acc
  }, {})

  console.log(`${statements.length} leads prontos para importar (${skipped} ignorados)`)
  console.log('\nPor funil:')
  Object.entries(funnelCounts).forEach(([funnel, count]) => console.log(`  ${funnel}: ${count}`))

  if (dryRun) {
    console.log('\nSimulação concluída.')
    return
  }

  console.log('\nImportando...')
  let done = 0
  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize).join('\n')
    runSql(batch)
    done += Math.min(batchSize, statements.length - i)
    process.stdout.write(`\r  ${done}/${statements.length}`)
  }

  console.log('\n\nImportação concluída.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
