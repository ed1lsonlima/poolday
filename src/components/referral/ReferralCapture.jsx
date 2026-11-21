import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { normalizeReferralCode, saveReferralCode } from '../../lib/referral'
import { trackEvent } from '../../lib/visitTracking'

// Qualquer página com ?ref=CODIGO guarda o código por 60 dias. Vale o primeiro link clicado.
export default function ReferralCapture() {
  const { search } = useLocation()
  useEffect(() => {
    const code = normalizeReferralCode(new URLSearchParams(search).get('ref'))
    if (!code) return
    saveReferralCode(code)
    trackEvent('visita-com-ref')
  }, [search])
  return null
}
