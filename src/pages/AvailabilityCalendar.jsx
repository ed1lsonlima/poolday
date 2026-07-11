import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, Save, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function toKey(date) { return date.toISOString().split('T')[0] }

export default function AvailabilityCalendar() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [blockedDates, setBlockedDates] = useState(new Set())      // estado original (do banco)
  const [pendingBlocked, setPendingBlocked] = useState(new Set())  // estado editado (nao salvo)
  const [bookedDates, setBookedDates] = useState(new Set())
  const [cursor, setCursor] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) fetchData() }, [user, id])

  async function fetchData() {
    setLoading(true)
    const { data: prop } = await supabase.from('properties').select('*').eq('id', id).single()
    if (!prop || prop.host_id !== user.id) { toast.error('Espaço não encontrado'); navigate('/anfitriao'); return }
    setProperty(prop)

    const { data: blocked } = await supabase.from('blocked_dates').select('date').eq('property_id', id)
    const blockedSet = new Set((blocked || []).map(b => b.date))
    setBlockedDates(blockedSet)
    setPendingBlocked(new Set(blockedSet))

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

  // Verifica se ha mudancas nao salvas
  const hasChanges = useMemo(() => {
    if (blockedDates.size !== pendingBlocked.size) return true
    for (const d of pendingBlocked) if (!blockedDates.has(d)) return true
    return false
  }, [blockedDates, pendingBlocked])

  function toggleDate(date) {
    if (date < today) return
    const key = toKey(date)
    if (bookedDates.has(key)) { toast.error('Essa data já tem uma reserva.'); return }
    const weekday = date.getDay()
    if (!property.available_days?.includes(weekday)) { toast.error('Esse dia da semana não está no seu padrão de disponibilidade.'); return }

    // Apenas altera o estado local (nao salva ainda)
    setPendingBlocked(prev => {
      const s = new Set(prev)
      if (s.has(key)) s.delete(key)
      else s.add(key)
      return s
    })
  }

  async function saveChanges() {
    setSaving(true)
    try {
      // Datas a adicionar (estao em pending mas nao no original)
      const toAdd = [...pendingBlocked].filter(d => !blockedDates.has(d))
      // Datas a remover (estao no original mas nao em pending)
      const toRemove = [...blockedDates].filter(d => !pendingBlocked.has(d))

      if (toAdd.length > 0) {
        const rows = toAdd.map(date => ({ property_id: id, date }))
        const { error } = await supabase.from('blocked_dates').insert(rows)
        if (error) throw error
      }
      if (toRemove.length > 0) {
        const { error } = await supabase.from('blocked_dates').delete().eq('property_id', id).in('date', toRemove)
        if (error) throw error
      }

      setBlockedDates(new Set(pendingBlocked))
      toast.success('Calendário salvo com sucesso!')
    } catch (err) {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally { setSaving(false) }
  }

  function discardChanges() {
    setPendingBlocked(new Set(blockedDates))
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

        <h1 className="text-xl font-bold text-gray-800 mb-1">Calendário de disponibilidade</h1>
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
              const isBlocked = pendingBlocked.has(key)
              const isOffPattern = !property.available_days?.includes(date.getDay())
              const disabled = isPast || isBooked || isOffPattern

              let classes = 'relative aspect-square rounded-lg flex items-center justify-center text-sm font-semibold transition-all '
              if (isPast || isOffPattern) classes += 'text-gray-300 cursor-not-allowed bg-gray-50'
              else if (isBooked) classes += 'bg-blue-500 text-white cursor-not-allowed shadow-sm'
              else if (isBlocked) classes += 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
              else classes += 'bg-green-500 text-white hover:bg-green-600 shadow-sm'

              return (
                <button key={i} type="button" disabled={disabled} onClick={() => toggleDate(date)} className={classes}>
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600">
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-green-500"/>Livre</div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-red-500"/>Bloqueado</div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-blue-500"/>Reservado</div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-gray-100 border border-gray-200"/>Indisponível</div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Toque em um dia <span className="text-green-600 font-medium">livre</span> pra bloqueá-lo (ex: já alugou por fora da plataforma). Toque num dia <span className="text-red-500 font-medium">bloqueado</span> pra liberar. Não esqueça de salvar.
        </p>

        {/* Barra de salvar - so aparece quando ha mudancas */}
        {hasChanges && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.2)] p-4">
            <div className="max-w-md mx-auto flex items-center gap-3">
              <button
                onClick={discardChanges}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
              >
                {saving ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/> Salvando...</>
                ) : (
                  <><Save size={16}/> Salvar alterações</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Espaco pra barra fixa nao cobrir conteudo */}
        {hasChanges && <div className="h-20" />}
      </div>
    </div>
  )
}
