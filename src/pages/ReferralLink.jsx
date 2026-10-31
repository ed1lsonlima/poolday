import { Navigate, useParams } from 'react-router-dom'
import { saveReferralCode } from '../lib/referral'

// /i/:codigo — guarda o código de quem indicou e leva para a página do anfitrião.
export default function ReferralLink() {
  const { codigo } = useParams()
  saveReferralCode(codigo)
  return <Navigate to="/seja-anfitriao" replace />
}
