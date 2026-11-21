import { useState } from 'react'
import { CheckCircle2, ExternalLink, TriangleAlert } from 'lucide-react'

// Checklist da administração antes de aprovar um espaço indicado. O botão Aprovar só libera
// com todos os itens marcados e sem coincidência de dados entre indicador e anfitrião.
export const CHECKLIST = [
  ['anuncio_completo', 'Anúncio completo: fotos, preço, dias disponíveis, regras e endereço.'],
  ['fotos_originais', 'As fotos não parecem tiradas da internet (conferi na busca reversa).'],
  ['endereco_confere', 'O endereço confere no Google Maps.'],
  ['dono_confirmou', 'Falei com o anfitrião pelo WhatsApp dele, e ele confirmou que é o dono ou responsável.'],
  ['video_recebido', 'Recebi um vídeo curto do espaço ou fiz uma chamada de vídeo.'],
  ['pessoas_diferentes', 'O anfitrião não é a mesma pessoa que indicou.'],
]

const lens = url => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`
const maps = property => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property.address, property.city, property.state].filter(Boolean).join(', '))}`

export default function ReferralReview({ property, coincidencias, onApprove, onAdjust, onReject, busy }) {
  const [marcados, setMarcados] = useState({})
  const [observacao, setObservacao] = useState('')
  const tudo = CHECKLIST.every(([chave]) => marcados[chave])
  const bloqueado = coincidencias.length > 0
  return <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/40 p-3 space-y-3">
    <p className="text-xs font-bold uppercase text-primary-700">Verificação antes de aprovar</p>
    {property?.images?.length > 0 && <div className="flex flex-wrap gap-2">{property.images.map((url, index) => <a key={url} href={lens(url)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-700 inline-flex items-center gap-1 bg-white border border-primary-100 rounded-lg px-2 py-1">Busca reversa foto {index + 1}<ExternalLink size={12}/></a>)}</div>}
    {property && <a href={maps(property)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-700 inline-flex items-center gap-1">Abrir endereço no Google Maps<ExternalLink size={12}/></a>}
    <p className={`text-xs rounded-lg p-2 flex gap-2 ${bloqueado ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{bloqueado ? <TriangleAlert size={14} className="shrink-0"/> : <CheckCircle2 size={14} className="shrink-0"/>}{bloqueado ? `Possível autoindicação: ${coincidencias.join(', ')}. Não aprove com recompensa.` : 'O sistema conferiu CPF, WhatsApp, e-mail e Pix: nenhum dado igual entre indicador e anfitrião.'}</p>
    <ul className="space-y-1.5">{CHECKLIST.map(([chave, texto]) => <li key={chave}><label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-primary-500 shrink-0" checked={!!marcados[chave]} onChange={e => setMarcados(m => ({ ...m, [chave]: e.target.checked }))}/>{texto}</label></li>)}</ul>
    <textarea className="input-field min-h-16 text-sm" maxLength={500} placeholder="Observação: como confirmou, link do vídeo ou do print (mínimo 5 letras)" value={observacao} onChange={e => setObservacao(e.target.value)}/>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !tudo || bloqueado || observacao.trim().length < 5 || !property} onClick={() => onApprove(marcados, observacao.trim())} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-40">Aprovar espaço</button>
      <button type="button" disabled={busy || !property} onClick={onAdjust} className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold px-4 py-2.5 disabled:opacity-40">Pedir ajuste</button>
      <button type="button" disabled={busy} onClick={onReject} className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 text-sm font-semibold px-4 py-2.5 disabled:opacity-40">Reprovar</button>
    </div>
    {!property && <p className="text-xs text-gray-500">O anfitrião ainda não enviou o espaço.</p>}
  </div>
}
