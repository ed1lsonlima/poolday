import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, X } from 'lucide-react'
import BookingCalendar, { normalizeBookingDate } from './BookingCalendar'

export default function DatePicker({ value, onChange, label = 'Data da reserva' }) {
  const dialog = useRef(null)
  const dialogId = useId()
  const [opening, setOpening] = useState(0)
  const [open, setOpen] = useState(false)
  const selectedValue = normalizeBookingDate(value)
  const display = selectedValue ? new Date(`${selectedValue}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Escolha uma data'
  return <>
    <button type="button" className="input-field flex items-center gap-3 text-left" aria-label={`${label}: ${display}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} onClick={() => { setOpening(n => n + 1); setOpen(true); dialog.current.showModal() }}>
      <CalendarDays size={20} className="text-primary-500 shrink-0" /><span className={selectedValue ? 'text-gray-800' : 'text-gray-500'}>{display}</span>
    </button>
    {createPortal(<dialog id={dialogId} ref={dialog} className="date-dialog" aria-label={label} onClose={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) dialog.current.close() }}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4"><div><p className="text-xs uppercase tracking-widest text-primary-600 font-bold">Seu dia de lazer</p><h2 className="font-bold text-xl text-gray-900 mt-1">{label}</h2></div><button type="button" className="p-2 rounded-full hover:bg-gray-100" aria-label="Fechar calendário" onClick={() => dialog.current.close()}><X size={20}/></button></div>
        <BookingCalendar key={opening} value={selectedValue} onChange={date => { onChange(date); dialog.current.close() }} />
        {value && <button type="button" className="mt-4 text-sm text-primary-600 font-semibold" onClick={() => { onChange(''); dialog.current.close() }}>Limpar data</button>}
      </div>
    </dialog>, document.body)}
  </>
}
