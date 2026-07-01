import * as XLSX from 'xlsx'
import { formatDate, formatPhone, STATUS_LABELS } from '@/lib/utils'
import type { EmailChannelClient } from '@/lib/clients-channels'
import type { Client } from '@/types/database'

function writeSpreadsheet(rows: Record<string, string | number>[], sheetName: string, filenamePrefix: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${filenamePrefix}-${date}.xlsx`)
}

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

  writeSpreadsheet(rows, 'Clientes', filenamePrefix)
}

export function exportWhatsAppClientsToSpreadsheet(clients: Client[]) {
  const rows = clients.map((client) => ({
    Nome: client.name,
    Telefone: client.phone ?? '',
    'Telefone formatado': formatPhone(client.phone),
    Email: client.email ?? '',
    Empresa: client.company ?? '',
    Status: STATUS_LABELS[client.status] ?? client.status,
    Origem: client.source ?? '',
    Observações: client.notes ?? '',
  }))

  writeSpreadsheet(rows, 'WhatsApp', 'clientes-whatsapp')
}

export function exportEmailClientsToSpreadsheet(clients: EmailChannelClient[]) {
  const rows = clients.map((client) => ({
    Nome: client.name,
    Email: client.email ?? '',
    Empresa: client.company ?? '',
    'Emails enviados': client.emails_sent,
    'Último envio': client.last_email_sent_at ? formatDate(client.last_email_sent_at) : '',
    Status: STATUS_LABELS[client.status] ?? client.status,
    'ID Mautic': client.mautic_contact_id ?? '',
  }))

  writeSpreadsheet(rows, 'Email', 'clientes-email')
}
