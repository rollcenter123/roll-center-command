import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmailCampaignReport } from '@/components/reports/EmailCampaignReport'
import { WhatsAppCampaignReport } from '@/components/reports/WhatsAppCampaignReport'
import {
  CampaignTypeSelector,
  type CampaignReportType,
} from '@/components/reports/CampaignTypeSelector'

interface CampaignReportSwitcherProps {
  showPageHeader?: boolean
  showSyncButton?: boolean
  showCrmKanban?: boolean
}

function parseReportType(value: string | null): CampaignReportType {
  return value === 'email' ? 'email' : 'whatsapp'
}

export function CampaignReportSwitcher({
  showPageHeader = false,
  showSyncButton = true,
  showCrmKanban = false,
}: CampaignReportSwitcherProps) {
  const [searchParams] = useSearchParams()
  const [campaignType, setCampaignType] = useState<CampaignReportType>(() =>
    parseReportType(searchParams.get('relatorio')),
  )

  useEffect(() => {
    setCampaignType(parseReportType(searchParams.get('relatorio')))
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('relatorio') !== 'whatsapp' || window.location.hash !== '#crm') return
    const timer = window.setTimeout(() => {
      document.getElementById('crm')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [searchParams, campaignType, showCrmKanban])

  const sharedProps = {
    showPageHeader,
    showSyncButton,
    showCrmKanban,
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
