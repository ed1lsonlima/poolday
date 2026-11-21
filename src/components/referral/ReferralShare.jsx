import toast from 'react-hot-toast'
import { Copy, MessageCircle } from 'lucide-react'
import { linkWhatsApp } from '../../lib/referralProgram'
import { trackEvent } from '../../lib/visitTracking'

export default function ReferralShare({ link, codigo }) {
  async function copiar() {
    try { await navigator.clipboard.writeText(link); toast.success('Link copiado.') }
    catch { toast.error('Não foi possível copiar. Selecione o link e copie.') }
  }
  return <div>
    <p className="text-xs text-gray-500">Seu código: <b className="text-gray-900 tracking-wider">{codigo}</b></p>
    <input readOnly aria-label="Seu link de indicação" value={link} className="input-field mt-2 text-sm" onFocus={event => event.target.select()}/>
    <div className="grid sm:grid-cols-2 gap-2 mt-3">
      <button type="button" onClick={copiar} className="btn-secondary inline-flex items-center justify-center gap-2 py-3"><Copy size={16}/>Copiar link</button>
      <a href={linkWhatsApp(link)} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('indique-whatsapp')} className="btn-primary inline-flex items-center justify-center gap-2 py-3"><MessageCircle size={16}/>Mandar no WhatsApp</a>
    </div>
  </div>
}
