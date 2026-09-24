import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Upload, X, Plus, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import CityField from '../components/common/CityField'
import { buildPublicPropertyTitle, containsExternalContact, isTrustedMapLink } from '../lib/propertySafety'
import { PRESENCE_OPTIONS } from '../lib/presence'

const TYPES = [
  { id: 'pool', label: 'Piscina' }, { id: 'chacara', label: 'Chácara' },
  { id: 'court', label: 'Quadra' }, { id: 'soccer', label: 'Campo de Futebol' },
]
const AMENITIES = ['Piscina','Wi-Fi','Estacionamento','Spa','Toalhas','Drinks','Vista mar','Jardim','Deck','Churrasqueira','Área gourmet','Som ambiente','Projetor','Câmeras de segurança']
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
// Taxa que o PoolDay retém sobre cada reserva. Um só lugar pra mexer no dia
// que mudar (ex: promo de lançamento a 12%). Reflete no cálculo do líquido.
const TAXA_POOLDAY = 0.15

function formatBRL(valor) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function NewProperty() {
  const { user } = useAuth()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState([])
  const [amenities, setAmenities] = useState([])
  const [availableDays, setAvailableDays] = useState([1,2,3,4,5,6,0])
  const [newAmenity, setNewAmenity] = useState('')
  const [form, setForm] = useState({
    type: 'pool', description: '', rules: '', checkin_instructions: '',
    city: '', neighborhood: '', address: '', landmark: '', map_url: '', state: 'AL', cep: '',
    price_per_day: '', max_capacity: '',
    hora_inicio: 8, hora_fim: 22, host_presence: 'host',
  })

  useEffect(() => { if (isEditing) loadProperty() }, [id])

  async function loadProperty() {
    const { data } = await supabase.from('properties').select('*').eq('id', id).single()
    if (data) {
      setForm({ type: data.type, description: data.description || '', rules: data.rules || '', checkin_instructions: data.checkin_instructions || '', city: data.city, neighborhood: data.neighborhood || '', address: data.address || '', landmark: data.landmark || '', map_url: data.map_url || '', state: data.state || 'AL', cep: data.cep || '', price_per_day: data.price_per_day || data.price_per_hour, max_capacity: data.max_capacity, hora_inicio: data.hora_inicio ?? 8, hora_fim: data.hora_fim ?? 22, host_presence: data.host_presence || 'host' })
      setImages(data.images || [])
      setAmenities((data.amenities || []).filter(a => a.localeCompare('Churrasco', 'pt-BR', { sensitivity: 'base' }) !== 0))
      setAvailableDays(data.available_days || [0,1,2,3,4,5,6])
    }
  }

  async function uploadImage(file) {
    if (!file) return
    if (images.length >= 10) { toast.error('Máximo 10 fotos!'); return }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { toast.error('Use JPG, PNG ou WebP!'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('property-images').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(path)
      setImages(prev => [...prev, publicUrl])
      toast.success('Foto adicionada!')
    } catch {
      toast.error('Erro ao enviar foto')
    } finally { setUploading(false) }
  }

  function toggleAmenity(a) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function addCustomAmenity() {
    const val = newAmenity.trim()
    if (!val) return
    if (val.localeCompare('Churrasco', 'pt-BR', { sensitivity: 'base' }) === 0) {
      toast.error('Use a opção "Churrasqueira".')
      setNewAmenity('')
      return
    }
    if (containsExternalContact(val)) {
      toast.error('Não coloque contato ou link nas comodidades.')
      return
    }
    // Evita duplicatas (case-insensitive)
    const exists = amenities.some(a => a.toLowerCase() === val.toLowerCase())
      || AMENITIES.some(a => a.toLowerCase() === val.toLowerCase())
    if (exists) {
      toast.error('Essa comodidade já foi adicionada.')
      setNewAmenity('')
      return
    }
    setAmenities(prev => [...prev, val])
    setNewAmenity('')
  }

  function removeAmenity(a) {
    setAmenities(prev => prev.filter(x => x !== a))
  }

  function toggleDay(d) {
    setAvailableDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  // Comodidades que o usuario digitou (nao estao na lista fixa)
  const customAmenities = amenities.filter(a => !AMENITIES.includes(a))

  async function handleSubmit(e) {
    e.preventDefault()
    if (containsExternalContact(form.description || '')) {
      toast.error('A descrição não pode conter @, redes sociais, links ou telefone. Use o chat do PoolDay após o pagamento da reserva.')
      return
    }
    if (containsExternalContact(form.rules || '')) {
      toast.error('As regras não podem conter @, redes sociais, links ou telefone.')
      return
    }
    if (amenities.some(containsExternalContact)) { toast.error('As comodidades não podem conter contato ou link.'); return }
    if (images.length === 0) { toast.error('Adicione pelo menos 1 foto!'); return }
    if (!form.city || !form.state) { toast.error('Selecione cidade e estado.'); return }
    if (!form.address.trim() || !form.landmark.trim() || form.checkin_instructions.trim().length < 15) { toast.error('Preencha endereço, ponto de referência e instruções de chegada.'); return }
    if (!isTrustedMapLink(form.map_url?.trim())) { toast.error('Use um link válido do Google Maps ou Waze.'); return }
    if (Number(form.price_per_day) < 30) { toast.error('Preço mínimo é R$ 30!'); return }
    if (Number(form.hora_inicio) >= Number(form.hora_fim)) { toast.error('O horário de término precisa ser depois do início.'); return }
    setLoading(true)
    try {
      const { municipality_code: _municipalityCode, ...propertyForm } = form
      const payload = { ...propertyForm, name: buildPublicPropertyTitle({ ...form, amenities }), images, amenities, available_days: availableDays, host_id: user.id, is_active: false, price_per_hour: null, max_capacity: Number(form.max_capacity), price_per_day: Number(form.price_per_day), hora_inicio: Number(form.hora_inicio), hora_fim: Number(form.hora_fim), video_url: null, map_url: form.map_url?.trim() || null }
      if (isEditing) {
        const { data, error } = await supabase.from('properties').update(payload).eq('id', id).eq('host_id', user.id).select('id').single()
        if (error) throw error
        if (!data) throw new Error('Espaço não atualizado')
        toast.success('Alterações enviadas para análise!')
      } else {
        const { error } = await supabase.from('properties').insert(payload)
        if (error) throw error
        toast.success('Espaço enviado para análise!')
      }
      navigate('/anfitriao')
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/anfitriao')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5">
          <ChevronLeft size={20}/> Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{isEditing ? 'Editar Espaço' : 'Novo Espaço'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">Tipo de espaço *</h2>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => setForm({...form, type: t.id})}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${form.type === t.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Informações básicas */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-bold text-gray-800">Informações básicas</h2>
            <CityField value={form} onChange={location => setForm(prev => ({ ...prev, ...location }))} required={!isEditing || !form.city} label="Cidade e estado do espaço" description="Cidade padronizada pelo IBGE para que seu espaço seja encontrado nas buscas." />
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Bairro</label>
              <input className="input-field" placeholder="Ex: Centro" value={form.neighborhood} onChange={e => setForm({...form, neighborhood: e.target.value})} />
            </div>
            <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
              <p className="text-xs font-bold uppercase text-primary-600">Título criado pelo PoolDay</p>
              <p className="font-bold text-gray-900 mt-1">{buildPublicPropertyTitle({ ...form, amenities })}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Preço por diária (R$) *</label>
                <input className="input-field" type="number" min="30" placeholder="Mín. R$ 30" value={form.price_per_day} onChange={e => setForm({...form, price_per_day: e.target.value})} required />
                <p className="text-xs text-gray-400 mt-1">É o valor que o cliente vê e paga.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Capacidade máx. *</label>
                <input className="input-field" type="number" min="1" placeholder="Ex: 20" value={form.max_capacity} onChange={e => setForm({...form, max_capacity: e.target.value})} required />
              </div>
            </div>

            {/* Demonstrativo de quanto o anfitrião recebe (taxa transparente).
                Só aparece quando há um preço válido digitado. */}
            {Number(form.price_per_day) >= 30 && (() => {
              const preco = Number(form.price_per_day)
              const taxa = preco * TAXA_POOLDAY
              const liquido = preco - taxa
              return (
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Cliente paga</span>
                    <span className="font-medium text-gray-800">R$ {formatBRL(preco)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1.5">
                    <span className="text-green-700 font-medium">Nas 3 primeiras reservas</span>
                    <span className="font-semibold text-green-700">Taxa zero</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary-100">
                    <span className="font-semibold text-gray-700">Você recebe nas 3 primeiras</span>
                    <span className="font-bold text-primary-600 text-lg">R$ {formatBRL(preco)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">A partir da 4ª reserva, a taxa é de {Math.round(TAXA_POOLDAY * 100)}% (R$ {formatBRL(taxa)}) e você recebe R$ {formatBRL(liquido)}. O cliente sempre paga o preço anunciado acima.</p>
                </div>
              )
            })()}
          </div>

          {/* Fotos */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-1">Fotos *</h2>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 my-3 text-xs text-amber-900"><b>Importante:</b> não envie foto ou vídeo com nome comercial, telefone, WhatsApp, @, QR Code, link ou marca-d’água.</div>
            <p className="text-xs text-gray-400 mb-3">Mínimo 1, máximo 10 fotos. Primeira foto é a capa.</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover"/>
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow">
                    <X size={14} className="text-red-500"/>
                  </button>
                  {i === 0 && <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">Capa</div>}
                </div>
              ))}
              {images.length < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all">
                  {uploading ? <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"/> : <><Upload size={20} className="text-gray-400 mb-1"/><span className="text-xs text-gray-400">Adicionar</span></>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => uploadImage(e.target.files[0])} disabled={uploading} />
                </label>
              )}
            </div>
          </div>

          {/* Comodidades */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">Comodidades</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${amenities.includes(a) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {a}
                </button>
              ))}
            </div>

            {/* Comodidades personalizadas adicionadas pelo usuario */}
            {customAmenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {customAmenities.map(a => (
                  <span key={a} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-primary-500 text-white">
                    {a}
                    <button type="button" onClick={() => removeAmenity(a)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors" aria-label={`Remover ${a}`}>
                      <X size={14}/>
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-sm py-2"
                placeholder="Outra comodidade... (ex: Piscina infantil)"
                value={newAmenity}
                onChange={e => setNewAmenity(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity() } }}
              />
              <button type="button" onClick={addCustomAmenity} className="bg-primary-500 text-white px-3 rounded-xl hover:bg-primary-600 flex items-center justify-center">
                <Plus size={16}/>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Digite e aperte Enter ou clique no + para adicionar.</p>
          </div>

          {/* Disponibilidade */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">Disponibilidade</h2>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Dias que você atende</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${availableDays.includes(i) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-400'}`}>
                  {d}
                </button>
              ))}
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <label className="text-sm font-medium text-gray-600 mb-2 block">Horário de funcionamento</label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">das</span>
                <select value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio: e.target.value})} className="input-field w-auto py-2">
                  {Array.from({length: 24}, (_, h) => <option key={h} value={h}>{String(h).padStart(2,'0')}h</option>)}
                </select>
                <span className="text-sm text-gray-500">às</span>
                <select value={form.hora_fim} onChange={e => setForm({...form, hora_fim: e.target.value})} className="input-field w-auto py-2">
                  {Array.from({length: 24}, (_, h) => <option key={h} value={h}>{String(h).padStart(2,'0')}h</option>)}
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3">O cliente reserva a diária inteira dentro desse horário. Não há seleção de quantidade de horas.</p>
            <div className="mt-5 pt-5 border-t border-gray-100"><label className="text-sm font-semibold text-gray-700 mb-2 block">Quem recebe o cliente?</label><select className="input-field" value={form.host_presence} onChange={event => setForm(previous => ({ ...previous, host_presence: event.target.value }))}>{PRESENCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p className="text-xs text-gray-500 mt-2">Você pode definir uma resposta diferente para uma data livre no calendário.</p></div>
          </div>

          {/* Descrição */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-bold text-gray-800">Descrição e Regras</h2>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Descrição do espaço</label>
              <textarea className="input-field resize-none" rows={4} placeholder="Descreva seu espaço..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              <p className="text-xs text-gray-400 mt-1">Não coloque contato aqui (Instagram, telefone, link). Use o chat do PoolDay após o pagamento da reserva.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Regras da casa</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Ex: Proibido fumar, sem barulho após 22h..." value={form.rules} onChange={e => setForm({...form, rules: e.target.value})} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Como chegar</h3>
              <p className="text-xs text-gray-500 mb-3">Esses dados ficam privados e só são liberados depois do pagamento confirmado.</p>
              <div className="space-y-3">
                <input className="input-field" placeholder="Endereço completo *" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                <input className="input-field" placeholder="Ponto de referência *" value={form.landmark} onChange={e => setForm({...form, landmark: e.target.value})} />
                <input className="input-field" placeholder="Link do Google Maps ou Waze" value={form.map_url} onChange={e => setForm({...form, map_url: e.target.value})} />
                <textarea className="input-field resize-none" rows={3} placeholder="Explique a estrada de acesso, entrada correta, portão e quem recebe o cliente. *" value={form.checkin_instructions} onChange={e => setForm({...form, checkin_instructions: e.target.value})} />
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500">{isEditing ? 'Ao salvar, o anúncio volta para análise e fica oculto até a nova aprovação. Reservas já realizadas não são canceladas.' : 'Seu anúncio será analisado pela equipe PoolDay antes de aparecer nas buscas.'}</p>
          <button type="submit" disabled={loading || uploading} className="btn-primary w-full py-4 text-base">
            {loading ? 'Enviando...' : (isEditing ? 'Salvar e enviar para análise' : 'Enviar espaço para análise')}
          </button>
        </form>
      </div>
    </div>
  )
}

