import { ChevronDown, Copy, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadCSV } from '../../lib/adminReports'

export function Badge({ children, warning, tone }) {
  const color = tone === 'success' ? 'bg-emerald-50 text-emerald-700' : tone === 'muted' ? 'bg-gray-100 text-gray-500' : warning ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{children}</span>
}

export function Metric({ label, value, note, icon: Icon, accent }) {
  return <article className="bg-white border border-gray-100 p-4 sm:p-5 rounded-2xl min-w-0"><div className="flex justify-between gap-2 text-xs sm:text-sm text-gray-500"><span>{label}</span>{Icon && <Icon size={18} className={`${accent ? 'text-orange-500' : 'text-primary-500'} shrink-0`}/>}</div><p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 break-words">{value}</p>{note && <p className="text-xs text-gray-400 mt-1">{note}</p>}</article>
}

export function Table({ headers, children }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{headers.map(h => <th key={h} className="bg-gray-50 px-4 py-3 text-xs uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{children}</tbody></table></div>
}
export function Cell({ children }) { return <td className="px-4 py-4 align-top">{children}</td> }
export function SummaryLine({ label, value }) { return <div><dt className="text-xs text-gray-500">{label}</dt><dd className="font-semibold text-gray-800 break-words mt-0.5">{value}</dd></div> }
export function Empty({ children = 'Nenhum registro neste período.' }) { return <p className="text-center text-gray-400 text-sm py-10">{children}</p> }

export function ExportButton({ rows, name }) {
  return <button type="button" disabled={!rows.length} onClick={() => downloadCSV(rows, name)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 disabled:opacity-40"><Download size={16}/>Exportar CSV</button>
}

// Seção recolhível (abre e fecha sem perder o conteúdo; acessível pelo teclado).
export function Collapsible({ title, note, badge, defaultOpen = false, actions, children }) {
  return <details open={defaultOpen} className="group bg-white border border-gray-100 rounded-3xl overflow-hidden">
    <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <span className="min-w-0"><span className="font-bold text-lg flex items-center gap-2 flex-wrap">{title}{badge}</span>{note && <span className="block text-xs text-gray-400 mt-0.5">{note}</span>}</span>
      <ChevronDown size={20} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180"/>
    </summary>
    {actions && <div className="px-5 pb-3 flex flex-wrap gap-3">{actions}</div>}
    {children}
  </details>
}

export function CopyButton({ value, label = 'Copiar' }) {
  async function copy() {
    try { await navigator.clipboard.writeText(value); toast.success('Copiado.') }
    catch { toast.error('Não foi possível copiar. Selecione e copie manualmente.') }
  }
  return <button type="button" onClick={copy} disabled={!value} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline disabled:opacity-40"><Copy size={13}/>{label}</button>
}

export function Chips({ options, value, onChange, label }) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">{options.map(([id, text, count]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`px-3.5 py-2 rounded-full text-sm font-semibold border ${value === id ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>{text}{count !== undefined && <span className="ml-1.5 opacity-80">{count}</span>}</button>)}</div>
}
