import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parseLocalDate } from '../../lib/formatDate'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function toISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Seletor de data PT-BR que mostra visualmente os dias indisponiveis
// (bloqueados, ja reservados, dias que o anfitriao nao atende, e datas passadas).
export default function BookingCalendar({ value, onChange, availableWeekdays, unavailableDates }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const initial = (value && parseLocalDate(value)) || today
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() })

  const startWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const servesAllDays = !availableWeekdays || availableWeekdays.length === 0

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isPastMonth = view.y < today.getFullYear() || (view.y === today.getFullYear() && view.m <= today.getMonth())
  const prevMonth = () => setView(v => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView(v => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  return (
    <div className="border border-gray-200 rounded-2xl p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} disabled={isPastMonth} aria-label="Mês anterior"
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
        <span className="font-semibold text-gray-800 text-sm">{MONTHS[view.m]} {view.y}</span>
        <button type="button" onClick={nextMonth} aria-label="Próximo mês"
          className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => <div key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = toISO(view.y, view.m, d)
          const dateObj = new Date(view.y, view.m, d)
          const isPast = dateObj < today
          const notServed = !servesAllDays && !availableWeekdays.includes(dateObj.getDay())
          const isBlocked = !!unavailableDates?.has(iso)
          const disabled = isPast || notServed || isBlocked
          const isSelected = value === iso
          const cls = isSelected
            ? 'bg-primary-500 text-white'
            : disabled
              ? 'text-gray-300 cursor-not-allowed line-through'
              : 'text-gray-700 hover:bg-primary-50 hover:text-primary-600'
          return (
            <button key={i} type="button" disabled={disabled} onClick={() => onChange(iso)}
              title={isBlocked ? 'Data indisponível' : notServed ? 'O anfitrião não atende neste dia' : ''}
              className={`aspect-square rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${cls}`}>
              {d}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-primary-500 inline-block" /> Selecionado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-200 inline-block" /> Indisponível</span>
      </div>
    </div>
  )
}
