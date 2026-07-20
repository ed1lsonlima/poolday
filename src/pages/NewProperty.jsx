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
const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
// Detecta contato externo (anti-fuga da plataforma): @, redes sociais, links, telefone
const CONTACT_RE = /@|instagram|whatsapp|facebook|tiktok|t\.me|wa\.me|https?:\/\/|www\.|\.com|\(\d{2}\)\s*\d|\d{8,}/i

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
    type: 'pool', name: '', description: '', rules: '', checkin_instructions: '',
    city: '', neighborhood: '', address: '', state: 'AL', cep: '',
    price_per_day: '', max_capacity: '', min_duration: 1,
    hora_inicio: 8, hora_fim: 22,
  })

  useEffect(() => { if (isEditing) loadProperty() }, [id])

  async function loadProperty() {
    const { data } = await supabase.from('properties').select('*').eq('id', id).single()
    if (data) {
      setForm({ type: data.type, name: data.name, description: data.description || '', rules: data.rules || '', checkin_instructions: data.checkin_instructions || '', city: data.city, neighborhood: data.neighborhood || '', address: data.address || '', state: data.state || 'AL', cep: data.cep || '', price_per_day: data.price_per_day || data.price_per_hour, max_capacity: data.max_capacity, min_duration: data.min_duration || 1, hora_inicio: data.hora_inicio ?? 8, hora_fim: data.hora_fim ?? 22 })
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

  function addCustomAmenity() {
    const val = newAmenity.trim()
    if (!val) return
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
    if (CONTACT_RE.test(form.name)) {
      toast.error('O nome do espaço não pode conter @, redes sociais, links ou telefone.')
      return
    }
    if (CONTACT_RE.test(form.description || '')) {
      toast.error('A descrição não pode conter @, redes sociais, links ou telefone. Você combina com o cliente pelo WhatsApp depois que ele reserva.')
      return
    }
    if (CONTACT_RE.test(form.rules || '')) {
      toast.error('As regras não podem conter @, redes sociais, links ou telefone.')
      return
    }
    if (images.length === 0) { toast.error('Adicione pelo menos 1 foto!'); return }
    if (Number(form.price_per_day) < 30) { toast.error('Preço mínimo é R$ 30!'); return }
    setLoading(true)
    try {
      const payload = { ...form, images, amenities, available_days: availableDays, host_id: user.id, is_active: true, price_per_hour: form.price_per_day, max_capacity: Number(form.max_capacity), min_duration: Number(form.min_duration), price_per_day: Number(form.price_per_day), hora_inicio: Number(form.hora_inicio), hora_fim: Number(form.hora_fim) }
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
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Nome do espaço *</label>
              <input className="input-field" placeholder="Ex: Chácara Recanto Verde" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              <p className="text-xs text-gray-400 mt-1">Use só o nome do espaço. Não coloque @ do Instagram, telefone, link ou endereço aqui.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Cidade *</label>
                <input className="input-field" placeholder="Ex: Arapiraca" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Estado *</label>
                <select className="input-field" value={form.state} onChange={e => setForm({...form, state: e.target.value})} required>
                  {BR_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
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
                    <span className="text-gray-600">Taxa PoolDay ({Math.round(TAXA_POOLDAY * 100)}%)</span>
                    <span className="font-medium text-gray-500">− R$ {formatBRL(taxa)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary-100">
                    <span className="font-semibold text-gray-700">Você recebe</span>
                    <span className="font-bold text-primary-600 text-lg">R$ {formatBRL(liquido)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Quer receber um valor exato? Ajuste o preço até o “Você recebe” bater. O cliente paga pelo site e o pagamento é garantido.</p>
                </div>
              )
            })()}
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

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-600 mb-1 block">Duração mínima da reserva (horas)</label>
              <input type="number" min="1" max="24" value={form.min_duration} onChange={e => setForm({...form, min_duration: e.target.value})} className="input-field w-28 py-2" />
            </div>
            <p className="text-xs text-gray-400 mt-3">Essas informações aparecem pro cliente na página do espaço. A reserva continua sendo por diária — o horário é combinado com você.</p>
          </div>

          {/* Descrição */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-bold text-gray-800">Descrição e Regras</h2>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Descrição do espaço</label>
              <textarea className="input-field resize-none" rows={4} placeholder="Descreva seu espaço..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              <p className="text-xs text-gray-400 mt-1">Não coloque contato aqui (Instagram, telefone, link). Você combina tudo com o cliente pelo WhatsApp depois que ele reserva.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Regras da casa</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Ex: Proibido fumar, sem barulho após 22h..." value={form.rules} onChange={e => setForm({...form, rules: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Instruções de check-in</label>
              <textarea className="input-field resize-none" rows={3} placeholder="Ex: Ao chegar, ligar para o interfone 101..." value={form.checkin_instructions} onChange={e => setForm({...form, checkin_instructions: e.target.value})} />
              <p className="text-xs text-gray-400 mt-1">Isso só aparece pro cliente <b>depois</b> que ele reserva — aqui pode colocar endereço, referência e como chegar.</p>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? 'Salvando...' : (isEditing ? 'Salvar alterações' : 'Cadastrar espaço')}
          </button>
        </form>
      </div>
    </div>
  )
}
