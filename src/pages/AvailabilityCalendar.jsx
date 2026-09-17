import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Info, Lock, Save, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function toKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AvailabilityCalendar() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [blockedDates, setBlockedDates] = useState(new Set())
  const [pendingBlocked, setPendingBlocked] = useState(new Set())
  const [bookedDates, setBookedDates] = useState(new Set())
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) fetchData() }, [user?.id, id])

  async function fetchData() {
    setLoading(true)
    const { data: prop } = await supabase.from('properties').select('*').eq('id', id).single()
    if (!prop || prop.host_id !== user.id) {
      toast.error('Espaço não encontrado')
      navigate('/anfitriao')
      return
    }
    setProperty(prop)

    const [{ data: blocked }, { data: bookings }] = await Promise.all([
      supabase.from('blocked_dates').select('date').eq('property_id', id),
      supabase.from('bookings').select('date').eq('property_id', id).in('status', ['pending', 'confirmed']),
    ])
    const blockedSet = new Set((blocked || []).map(item => item.date))
    setBlockedDates(blockedSet)
    setPendingBlocked(new Set(blockedSet))
    setBookedDates(new Set((bookings || []).map(item => item.date)))
    setLoading(false)
  }

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const firstVisibleMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const availableWeekdays = useMemo(() => new Set((property?.available_days || []).map(Number)), [property?.available_days])

  const days = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const cells = Array(new Date(year, month, 1).getDay()).fill(null)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
    while (cells.length % 7) cells.push(null)
    return cells
  }, [cursor])

  const hasChanges = useMemo(() => {
    if (blockedDates.size !== pendingBlocked.size) return true
    for (const date of pendingBlocked) if (!blockedDates.has(date)) return true
    return false
  }, [blockedDates, pendingBlocked])

  const monthStats = useMemo(() => {
    const stats = { free: 0, blocked: 0, booked: 0 }
    for (const date of days) {
      if (!date || date < today || !availableWeekdays.has(date.getDay())) continue
      const key = toKey(date)
      if (bookedDates.has(key)) stats.booked += 1
      else if (pendingBlocked.has(key)) stats.blocked += 1
      else stats.free += 1
    }
    return stats
  }, [availableWeekdays, bookedDates, days, pendingBlocked, today])

  function toggleDate(date) {
    if (date < today) return
    const key = toKey(date)
    if (bookedDates.has(key)) {
      toast.error('Essa data já tem uma reserva.')
      return
    }
    if (!availableWeekdays.has(date.getDay())) {
      toast.error('Esse dia não faz parte do seu padrão semanal.')
      return
    }
    setPendingBlocked(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function saveChanges() {
    setSaving(true)
    try {
      const toAdd = [...pendingBlocked].filter(date => !blockedDates.has(date))
      const toRemove = [...blockedDates].filter(date => !pendingBlocked.has(date))
      if (toAdd.length) {
        const { error } = await supabase.from('blocked_dates').insert(toAdd.map(date => ({ property_id: id, date })))
        if (error) throw error
      }
      if (toRemove.length) {
        const { error } = await supabase.from('blocked_dates').delete().eq('property_id', id).in('date', toRemove)
        if (error) throw error
      }
      setBlockedDates(new Set(pendingBlocked))
      toast.success('Disponibilidade atualizada!')
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function goToToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" aria-label="Carregando calendário">
      <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )

  const previousDisabled = cursor <= firstVisibleMonth

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-10">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <button onClick={() => navigate('/anfitriao')} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary-600 mb-5">
          <ChevronLeft size={18} /> Voltar ao painel
        </button>

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-blue-500 text-white p-6 sm:p-8 shadow-xl shadow-primary-900/10 mb-6">
          <div className="absolute -right-10 -top-12 w-44 h-44 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-white/75 text-xs font-bold uppercase tracking-[0.18em] mb-2"><CalendarDays size={15} /> Disponibilidade</div>
              <h1 className="text-2xl sm:text-3xl font-extrabold">Calendário do espaço</h1>
              <p className="text-white/80 mt-1">{property?.name}</p>
            </div>
            <button onClick={goToToday} className="self-start sm:self-auto rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 text-sm font-semibold transition-colors">Ir para hoje</button>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6" aria-label="Resumo do mês">
          {[
            { label: 'Livres', value: monthStats.free, className: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
            { label: 'Bloqueadas', value: monthStats.blocked, className: 'text-rose-600 bg-rose-50 border-rose-100' },
            { label: 'Reservadas', value: monthStats.booked, className: 'text-blue-600 bg-blue-50 border-blue-100' },
          ].map(item => (
            <div key={item.label} className={`rounded-2xl border p-3 sm:p-4 text-center ${item.className}`}>
              <p className="text-2xl font-extrabold">{item.value}</p>
              <p className="text-[11px] sm:text-xs font-semibold mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-3 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-5">
            <button type="button" disabled={previousDisabled} onClick={() => setCursor(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Mês anterior">
              <ChevronLeft size={19} />
            </button>
            <div className="text-center">
              <p className="font-extrabold text-gray-900 text-lg">{MONTHS[cursor.getMonth()]}</p>
              <p className="text-xs text-gray-400">{cursor.getFullYear()}</p>
            </div>
            <button type="button" onClick={() => setCursor(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50" aria-label="Próximo mês">
              <ChevronRight size={19} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {WEEKDAYS.map(weekday => <div key={weekday} className="text-center text-[10px] sm:text-xs font-bold uppercase text-gray-400 py-1">{weekday}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {days.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} aria-hidden="true" />
              const key = toKey(date)
              const isPast = date < today
              const isToday = key === toKey(today)
              const isBooked = bookedDates.has(key)
              const isBlocked = pendingBlocked.has(key)
              const isOffPattern = !availableWeekdays.has(date.getDay())
              const disabled = isPast || isBooked || isOffPattern
              const state = isBooked ? 'reservada' : isBlocked ? 'bloqueada' : disabled ? 'indisponível' : 'livre'
              let classes = 'relative min-h-11 sm:min-h-14 rounded-xl flex items-center justify-center text-sm font-bold border transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1 '
              if (isPast || isOffPattern) classes += 'border-transparent text-gray-300 bg-gray-50 cursor-not-allowed '
              else if (isBooked) classes += 'border-blue-500 bg-blue-500 text-white cursor-not-allowed shadow-sm '
              else if (isBlocked) classes += 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 '
              else classes += 'border-gray-200 bg-white text-gray-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 '
              if (isToday) classes += 'ring-2 ring-primary-400 ring-offset-2 '

              return (
                <button key={key} type="button" disabled={disabled} aria-label={`${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}, ${state}`} aria-pressed={isBlocked} onClick={() => toggleDate(date)} className={classes}>
                  {date.getDate()}
                  {isBooked && <CircleCheck size={12} className="absolute bottom-1 right-1 hidden sm:block" />}
                  {isBlocked && <Lock size={11} className="absolute bottom-1 right-1 hidden sm:block" />}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 pt-5 border-t border-gray-100 text-xs text-gray-600">
            <Legend color="border-gray-300 bg-white" label="Livre" />
            <Legend color="border-rose-200 bg-rose-50" label="Bloqueada" />
            <Legend color="border-blue-500 bg-blue-500" label="Reservada" />
            <Legend color="border-gray-100 bg-gray-50" label="Fora do padrão" />
          </div>
        </section>

        <div className="mt-5 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          <Info size={19} className="shrink-0 mt-0.5" />
          <p><b>Como usar:</b> toque em uma data livre para bloqueá-la quando o espaço não puder receber reservas. Toque novamente para liberar. Datas já reservadas ficam protegidas.</p>
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-8px_30px_-16px_rgba(15,23,42,0.45)] p-3 sm:p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="hidden sm:block flex-1">
              <p className="font-bold text-gray-800">Você tem alterações não salvas</p>
              <p className="text-xs text-gray-500">Revise as datas e confirme para atualizar o anúncio.</p>
            </div>
            <button onClick={() => setPendingBlocked(new Set(blockedDates))} disabled={saving} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 disabled:opacity-50">
              <Undo2 size={16} /> Descartar
            </button>
            <button onClick={saveChanges} disabled={saving} className="flex-1 sm:flex-none btn-primary inline-flex items-center justify-center gap-2 py-3 px-6 text-sm">
              {saving ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Salvando...</> : <><Save size={16} /> Salvar calendário</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Legend({ color, label }) {
  return <div className="flex items-center gap-2"><span className={`w-4 h-4 rounded-md border ${color}`} /><span>{label}</span></div>
}
