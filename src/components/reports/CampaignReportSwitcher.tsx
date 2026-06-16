import { useState } from 'react'
import { EmailCampaignReport } from '@/components/reports/EmailCampaignReport'
import { WhatsAppCampaignReport } from '@/components/reports/WhatsAppCampaignReport'
import {
  CampaignTypeSelector,
  type CampaignReportType,
} from '@/components/reports/CampaignTypeSelector'

interface CampaignReportSwitcherProps {
  showPageHeader?: boolean
  showSyncButton?: boolean
}

export function CampaignReportSwitcher({
  showPageHeader = false,
  showSyncButton = true,
}: CampaignReportSwitcherProps) {
  const [campaignType, setCampaignType] = useState<CampaignReportType>('email')

  const sharedProps = {
    showPageHeader,
    showSyncButton,
    campaignType,
    onCampaignTypeChange: setCampaignType,
    campaignSelector: (
      <CampaignTypeSelector value={campaignType} onChange={setCampaignType} />
    ),
  }

  if (campaignType === 'whatsapp') {
    return <WhatsAppCampaignReport {...sharedProps} />
  }

  return <EmailCampaignReport {...sharedProps} />
}
