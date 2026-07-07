import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Upload, X, Plus, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPES = [
  { id: 'pool', label: 'Piscina' }, { id: 'chacara', label: 'Chácara' },
  { id: 'gourmet', label: 'Espaço Gourmet' }, { id: 'court', label: 'Quadra' },
  { id: 'soccer', label: 'Campo de Futebol' }, { id: 'futevolei', label: 'Quadra de Futevôlei' },
]
const AMENITIES = ['Piscina','Wi-Fi','Estacionamento','Churrasco','Spa','Toalhas','Drinks','Vista mar','Jardim','Deck','Churrasqueira','Área gourmet','Som ambiente','Projetor','Câmeras de segurança']
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

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
    type: 'pool', name: '', description: '', rules: '', checkin_instructions: '',
    city: '', neighborhood: '', address: '', state: 'AL', cep: '',
    price_per_day: '', max_capacity: '', min_duration: 1,
  })

  useEffect(() => { if (isEditing) loadProperty() }, [id])

  async function loadProperty() {
    const { data } = await supabase.from('properties').select('*').eq('id', id).single()
    if (data) {
      setForm({ type: data.type, name: data.name, description: data.description || '', rules: data.rules || '', checkin_instructions: data.checkin_instructions || '', city: data.city, neighborhood: data.neighborhood || '', address: data.address || '', state: data.state || 'AL', cep: data.cep || '', price_per_day: data.price_per_day || data.price_per_hour, max_capacity: data.max_capacity, min_duration: data.min_duration || 1 })
      setImages(data.images || [])
      setAmenities(data.amenities || [])
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
    } catch (err) {
      toast.error('Erro ao enviar foto')
    } finally { setUploading(false) }
  }

  function toggleAmenity(a) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function toggleDay(d) {
    setAvailableDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (images.length === 0) { toast.error('Adicione pelo menos 1 foto!'); return }
    if (Number(form.price_per_day) < 30) { toast.error('Preço mínimo é R$ 30!'); return }
    setLoading(true)
    try {
      const payload = { ...form, images, amenities, available_days: availableDays, host_id: user.id, is_active: true, price_per_hour: form.price_per_day, max_capacity: Number(form.max_capacity), min_duration: Number(form.min_duration), price_per_day: Number(form.price_per_day) }
      if (isEditing) {
        await supabase.from('properties').update(payload).eq('id', id)
        toast.success('Espaço atualizado!')
      } else {
        await supabase.from('properties').insert(payload)
        toast.success('Espaço cadastrado!')
      }
      navigate('/anfitriao')
    } catch (err) {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/anfitriao')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5">
          <ChevronLeft size={20}/> Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{isEditing ? 'Editar Espaço' : 'Nova Piscina'}</h1>

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
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Nome do espaço *</label>
              <input className="input-field" placeholder="Ex: Chácara Recanto Verde" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Cidade *</label>
                <input className="input-field" placeholder="Ex: Arapiraca" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Estado *</label>
                <input className="input-field" placeholder="Ex: AL" value={form.state} onChange={e => setForm({...form, state: e.target.value})} required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Bairro</label>
              <input className="input-field" placeholder="Ex: Centro" value={form.neighborhood} onChange={e => setForm({...form, neighborhood: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Preço por diária (R$) *</label>
                <input className="input-field" type="number" min="30" placeholder="Mín. R$ 30" value={form.price_per_day} onChange={e => setForm({...form, price_per_day: e.target.value})} required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Capacidade máx. *</label>
                <input className="input-field" type="number" min="1" placeholder="Ex: 20" value={form.max_capacity} onChange={e => setForm({...form, max_capacity: e.target.value})} required />
              </div>
            </div>
          </div>

          {/* Fotos */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-1">Fotos *</h2>
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
            <div className="flex gap-2">
              <input className="input-field flex-1 text-sm py-2" placeholder="Outra comodidade..." value={newAmenity} onChange={e => setNewAmenity(e.target.value)} />
              <button type="button" onClick={() => { if(newAmenity.trim()) { setAmenities(p => [...p, newAmenity.trim()]); setNewAmenity('') }}} className="bg-primary-500 text-white px-3 rounded-xl hover:bg-primary-600"><Plus size={16}/></button>
            </div>
          </div>

          {/* Disponibilidade */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">Disponibilidade</h2>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${availableDays.includes(i) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-400'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-bold text-gray-800">Descrição e Regras</h2>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Descrição do espaço</label>
              <textarea className="input-field resize-none" rows={4} placeholder="Descreva seu espaço..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Regras da casa</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Ex: Proibido fumar, sem barulho após 22h..." value={form.rules} onChange={e => setForm({...form, rules: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Instruções de check-in</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Ex: Ao chegar, ligar para o interfone 101..." value={form.checkin_instructions} onChange={e => setForm({...form, checkin_instructions: e.target.value})} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? 'Salvando...' : (isEditing ? 'Salvar alterações' : 'Cadastrar piscina')}
          </button>
        </form>
      </div>
    </div>
  )
}
