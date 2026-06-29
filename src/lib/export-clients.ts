import * as XLSX from 'xlsx'
import { STATUS_LABELS } from '@/lib/utils'
import type { Client } from '@/types/database'

export function exportClientsToSpreadsheet(clients: Client[], filenamePrefix = 'clientes') {
  const rows = clients.map((client) => ({
    Nome: client.name,
    Email: client.email ?? '',
    Telefone: client.phone ?? '',
    Empresa: client.company ?? '',
    Status: STATUS_LABELS[client.status] ?? client.status,
    Origem: client.source ?? '',
    Observações: client.notes ?? '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes')

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${filenamePrefix}-${date}.xlsx`)
}
