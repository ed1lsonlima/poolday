import { VISIT_CONSENT_TEXT } from '../../lib/hostVerification'

export default function VisitConsentField({ checked, onChange }) {
  return (
    <label className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-primary-500"/>
      <span className="text-sm text-gray-700">{VISIT_CONSENT_TEXT} <span className="text-gray-500">Sem esse aceite, o espaço não pode ser publicado.</span></span>
    </label>
  )
}
