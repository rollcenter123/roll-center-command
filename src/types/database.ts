export type UserRole = 'admin' | 'operator' | 'viewer'

export interface ProfilePermissions {
  dashboard: boolean
  clients_view: boolean
  clients_edit: boolean
  campaigns_view: boolean
  campaigns_edit: boolean
  metrics_view: boolean
  metrics_pdf: boolean
  import_clients: boolean
  integrations: boolean
  team_manage: boolean
}
export type ClientStatus = 'lead' | 'contacted' | 'converted' | 'inactive'
export type CampaignChannel = 'email' | 'whatsapp'
export type WhatsAppProvider = 'uazapi' | 'cloud_api'
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed'
export type RecipientStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'read'
  | 'replied'
  | 'failed'
  | 'bounced'
  | 'unsubscribed'
export type EventType =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'read'
  | 'replied'
  | 'failed'
  | 'bounced'
  | 'unsubscribed'
export type IntegrationProvider = 'mautic' | 'uazapi' | 'whatsapp_cloud'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  permissions: Partial<ProfilePermissions>
  created_at: string
  updated_at: string
}

export interface WhatsAppStage {
  id: string
  name: string
  position: number
  color: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  status: ClientStatus
  source: string | null
  notes: string | null
  mautic_contact_id: number | null
  whatsapp_opt_in: boolean
  email_opt_in: boolean
  tags: string[]
  custom_fields: Record<string, unknown>
  whatsapp_stage_id: string | null
  created_at: string
  updated_at: string
  whatsapp_stages?: WhatsAppStage | null
}

export interface Campaign {
  id: string
  name: string
  description: string | null
  channel: CampaignChannel
  whatsapp_provider: WhatsAppProvider | null
  status: CampaignStatus
  mautic_campaign_id: number | null
  message_template: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  client_id: string
  status: RecipientStatus
  external_message_id: string | null
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  read_at: string | null
  replied_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  clients?: Client
}

export interface CampaignEvent {
  id: string
  campaign_id: string | null
  client_id: string | null
  recipient_id: string | null
  event_type: EventType
  channel: CampaignChannel | null
  provider: string | null
  payload: Record<string, unknown>
  occurred_at: string
  created_at: string
}

export interface IntegrationSetting {
  id: string
  provider: IntegrationProvider
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppInstance {
  id: string
  name: string
  instance_token_ref: string
  status: string
  phone_number: string | null
  created_at: string
  updated_at: string
}

export interface DailyMetric {
  id: string
  date: string
  channel: CampaignChannel | 'clients'
  sent: number
  delivered: number
  opened: number
  clicked: number
  read_count: number
  replied: number
  failed: number
  new_clients: number
  created_at: string
}

export interface MauticCampaign {
  id: number
  name: string
  isPublished: boolean
  contactCount?: number
}

export interface MauticEmail {
  id: string
  mautic_email_id?: number
  nome: string
  assunto: string | null
  segmento: string | null
  enviados: number
  abertos: number
  publicado: boolean
  criado_em?: string | null
  atualizado_em?: string | null
  synced_at?: string | null
}
