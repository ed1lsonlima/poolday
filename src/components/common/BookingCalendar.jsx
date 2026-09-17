import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parseLocalDate } from '../../lib/formatDate'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function toISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function normalizeBookingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = parseLocalDate(value)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (!date || Number.isNaN(date.getTime()) || date < today) return ''
  return toISO(date.getFullYear(), date.getMonth(), date.getDate()) === value ? value : ''
}

// Seletor de data PT-BR que mostra visualmente os dias indisponiveis
// (bloqueados, ja reservados, dias que o anfitriao nao atende, e datas passadas).
export default function BookingCalendar({ value, onChange, availableWeekdays, unavailableDates }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const selectedValue = normalizeBookingDate(value)
  const initial = (selectedValue && parseLocalDate(selectedValue)) || today
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() })

  useEffect(() => {
    const selected = parseLocalDate(selectedValue) || new Date()
    setView({ y: selected.getFullYear(), m: selected.getMonth() })
  }, [selectedValue])

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
    <div className="booking-calendar border border-primary-100 bg-white rounded-2xl p-3 sm:p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} disabled={isPastMonth} aria-label="Mês anterior"
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
        <span aria-live="polite" className="font-bold text-gray-800">{MONTHS[view.m]} <span className="font-normal text-gray-400">{view.y}</span></span>
        <button type="button" onClick={nextMonth} aria-label="Próximo mês"
          className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => <div key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1">{w}</div>)}
      </div>

      <div key={`${view.y}-${view.m}`} className="calendar-month grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = toISO(view.y, view.m, d)
          const dateObj = new Date(view.y, view.m, d)
          const isPast = dateObj < today
          const notServed = !servesAllDays && !availableWeekdays.includes(dateObj.getDay())
          const isBlocked = !!unavailableDates?.has(iso)
          const disabled = isPast || notServed || isBlocked
          const isSelected = selectedValue === iso
          const cls = isSelected
            ? 'bg-primary-500 text-white shadow-md shadow-primary-100'
            : disabled
              ? 'text-gray-300 cursor-not-allowed line-through'
              : `text-gray-700 hover:bg-primary-50 hover:text-primary-600 ${dateObj.getTime() === today.getTime() ? 'ring-1 ring-inset ring-primary-300' : 'bg-gray-50/70'}`
          return (
            <button key={i} type="button" disabled={disabled} aria-pressed={isSelected} aria-label={`${dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${disabled ? ', indisponível' : ''}`} onClick={() => onChange(iso)}
              title={isBlocked ? 'Data indisponível' : notServed ? 'O anfitrião não atende neste dia' : ''}
              className={`aspect-square min-h-9 rounded-xl text-sm font-semibold flex items-center justify-center transition-all duration-150 focus-visible:outline-primary-500 active:scale-95 ${cls}`}>
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
