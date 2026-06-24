import { getSupabaseAdmin } from './supabase-admin.ts'

export interface WhatsAppCloudCredentials {
  accessToken: string
  phoneNumberId: string
  wabaId?: string
  source: 'database' | 'env'
}

export async function getWhatsAppCloudCredentials(): Promise<WhatsAppCloudCredentials | null> {
  const supabase = getSupabaseAdmin()
  const { data: setting } = await supabase
    .from('integration_settings')
    .select('config, is_active')
    .eq('provider', 'whatsapp_cloud')
    .maybeSingle()

  const config = setting?.config as Record<string, string> | undefined
  if (setting?.is_active && config?.access_token && config?.phone_number_id) {
    return {
      accessToken: config.access_token,
      phoneNumberId: config.phone_number_id,
      wabaId: config.waba_id,
      source: 'database',
    }
  }

  const envToken = Deno.env.get('WHATSAPP_CLOUD_TOKEN')
  const envPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (envToken && envPhoneId) {
    return {
      accessToken: envToken,
      phoneNumberId: envPhoneId,
      source: 'env',
    }
  }

  return null
}
