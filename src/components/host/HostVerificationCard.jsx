import { MessageCircle, ShieldAlert } from 'lucide-react'
import { formatDateBR } from '../../lib/formatDate'
import { VERIFICATION_STEPS, verificationStatus, verificationWhatsappLink } from '../../lib/hostVerification'

const localDay = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Maceio' })

export default function HostVerificationCard({ dueAt, verified }) {
  const { state, daysLeft } = verificationStatus(dueAt, verified)
  if (state === 'none') return null
  const overdue = state === 'overdue'
  return (
    <section aria-label="Verificação de documentos" className={`rounded-2xl border p-4 sm:p-5 mb-6 ${overdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-start gap-3">
        <ShieldAlert size={22} className={`shrink-0 mt-0.5 ${overdue ? 'text-red-600' : 'text-amber-600'}`}/>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900">{overdue ? 'Prazo de verificação vencido' : `Verifique seus documentos até ${formatDateBR(localDay(dueAt))}`}</h2>
          <p className="text-sm text-gray-700 mt-1">
            {overdue
              ? 'Seu espaço não está recebendo novas reservas. As reservas que já existem continuam valendo. Envie seus documentos para voltar a receber.'
              : `${daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${daysLeft} dias`}. Depois desse prazo, seu espaço para de receber novas reservas.`}
          </p>
          <p className="text-sm font-semibold text-gray-800 mt-3">Envie pelo WhatsApp do PoolDay:</p>
          <ol className="list-decimal pl-5 text-sm text-gray-700 mt-1 space-y-0.5">{VERIFICATION_STEPS.map(step => <li key={step}>{step}</li>)}</ol>
          <a href={verificationWhatsappLink()} target="_blank" rel="noreferrer" className="btn-primary inline-flex items-center gap-2 mt-4 py-2.5 px-4 text-sm"><MessageCircle size={16}/>Enviar pelo WhatsApp</a>
          <p className="text-xs text-gray-500 mt-2">Usamos seus documentos só para confirmar sua identidade. Depois da conferência, a verificação aparece no seu painel.</p>
        </div>
      </div>
    </section>
  )
}
