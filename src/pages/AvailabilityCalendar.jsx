import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
const MONTHS = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function toKey(date) { return date.toISOString().split('T')[0] }

export default function AvailabilityCalendar() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [blockedDates, setBlockedDates] = useState(new Set())
  const [bookedDates, setBookedDates] = useState(new Set())
  const [cursor, setCursor] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) fetchData() }, [user, id])

  async function fetchData() {
    setLoading(true)
    const { data: prop } = await supabase.from('properties').select('*').eq('id', id).single()
    if (!prop || prop.host_id !== user.id) { toast.error('Espaco nao encontrado'); navigate('/anfitriao'); return }
    setProperty(prop)

    const { data: blocked } = await supabase.from('blocked_dates').select('date').eq('property_id', id)
    setBlockedDates(new Set((blocked || []).map(b => b.date)))

    const { data: bookings } = await supabase.from('bookings').select('date').eq('property_id', id).in('status', ['pending', 'confirmed'])
    setBookedDates(new Set((bookings || []).map(b => b.date)))

    setLoading(false)
  }

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const days = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    return cells
  }, [cursor])

  async function toggleDate(date) {
    if (date < today) return
    const key = toKey(date)
    if (bookedDates.has(key)) { toast.error('Essa data ja tem uma reserva.'); return }
    const weekday = date.getDay()
    if (!property.available_days?.includes(weekday)) { toast.error('Esse dia da semana nao esta no seu padrao de disponibilidade.'); return }

    setSaving(true)
    try {
      if (blockedDates.has(key)) {
        await supabase.from('blocked_dates').delete().eq('property_id', id).eq('date', key)
        setBlockedDates(prev => { const s = new Set(prev); s.delete(key); return s })
      } else {
        await supabase.from('blocked_dates').insert({ property_id: id, date: key })
        setBlockedDates(prev => new Set(prev).add(key))
      }
    } catch (err) {
      toast.error('Erro ao atualizar. Tente novamente.')
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6">
        <button onClick={() => navigate('/anfitriao')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft size={20}/> Voltar
        </button>

        <h1 className="text-xl font-bold text-gray-800 mb-1">Calendario de disponibilidade</h1>
        <p className="text-sm text-gray-500 mb-5">{property?.name}</p>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronLeft size={18}/>
            </button>
            <span className="font-semibold text-gray-800">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronRight size={18}/>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(w => <div key={w} className="text-center text-xs font-medium text-gray-400 py-1">{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((date, i) => {
              if (!date) return <div key={i} />
              const key = toKey(date)
              const isPast = date < today
              const isBooked = bookedDates.has(key)
              const isBlocked = blockedDates.has(key)
              const isOffPattern = !property.available_days?.includes(date.getDay())
              const disabled = isPast || isBooked || isOffPattern

              let classes = 'aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all '
              if (isPast || isOffPattern) classes += 'text-gray-300 cursor-not-allowed'
              else if (isBooked) classes += 'bg-primary-100 text-primary-700 cursor-not-allowed'
              else if (isBlocked) classes += 'bg-gray-200 text-gray-500 hover:bg-gray-300'
              else classes += 'bg-green-50 text-green-700 hover:bg-green-100'

              return (
                <button key={i} type="button" disabled={disabled} onClick={() => toggleDate(date)} className={classes}>
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-50 border border-green-200"/>Livre</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-200"/>Bloqueado por voce</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary-100"/>Reservado</div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">Toque em um dia livre pra bloquea-lo (ex: ja alugou por fora da plataforma). Toque de novo pra liberar. {saving && 'Salvando...'}</p>
      </div>
    </div>
  )
}
