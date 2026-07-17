import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Upload, X, Plus, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPES = [
  { id: 'pool', label: 'Piscina' }, { id: 'chacara', label: 'Chácara' },
  { id: 'gourmet', label: 'Espaço Gourmet' }, { id: 'court', label: 'Quadra' },
  { id: 'soccer', label: 'Campo de Futebol' }, { id: 'futevolei', label: 'Quadra de Futevôlei' },
]
const AMENITIES = ['Piscina','Wi-Fi','Estacionamento','Churrasco','Spa','Toalhas','Drinks','Vista mar','Jardim','Deck','Churrasqueira','Área gourmet','Som ambiente','Projetor','Câmeras de segurança']
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const CONTACT_RE = /@|instagram|whatsapp|facebook|tiktok|t\.me|wa\.me|https?:\/\/|www\.|\.com|\(\d{2}\)\s*\d|\d{8,}/i
const STEPS = ['Tipo e local', 'Informações', 'Fotos', 'Comodidades', 'Revisão']

export default function OnboardingWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
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

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  function validateStep() {
    if (step === 0 && (!form.city || !form.state)) { toast.error('Preencha cidade e estado'); return false }
    if (step === 1 && (!form.name || !form.price_per_day || !form.max_capacity)) { toast.error('Preencha nome, preço e capacidade'); return false }
    if (step === 1 && CONTACT_RE.test(form.name)) { toast.error('O nome do espaço não pode conter @, redes sociais, links ou telefone.'); return false }
    if (step === 1 && Number(form.price_per_day) < 30) { toast.error('Preço mínimo é R$ 30'); return false }
    if (step === 2 && images.length === 0) { toast.error('Adicione pelo menos 1 foto'); return false }
    return true
  }

  function goNext() { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  function goBack() { setStep(s => Math.max(s - 1, 0)) }

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

  async function handlePublish() {
    if (CONTACT_RE.test(form.description || '')) { toast.error('A descrição não pode conter @, redes sociais, links ou telefone. Você combina com o cliente pelo WhatsApp depois que ele reserva.'); return }
    if (CONTACT_RE.test(form.rules || '')) { toast.error('As regras não podem conter @, redes sociais, links ou telefone.'); return }
    setLoading(true)
    try {
      const payload = { ...form, images, amenities, available_days: availableDays, host_id: user.id, is_active: true, price_per_hour: form.price_per_day, max_capacity: Number(form.max_capacity), min_duration: Number(form.min_duration), price_per_day: Number(form.price_per_day) }
      await supabase.from('properties').insert(payload)
      toast.success('Espaço publicado!')
      navigate('/anfitriao')
    } catch (err) {
      toast.error('Erro ao publicar. Tente novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => step === 0 ? navigate('/anfitriao') : goBack()} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5">
          <ChevronLeft size={20}/> Voltar
        </button>

        <div className="flex gap-1.5 mb-2">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary-500' : 'bg-gray-200'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-1">Passo {step + 1} de {STEPS.length}</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{STEPS[step]}</h1>

        {step === 0 && (
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 mb-3 text-sm">Tipo de espaço *</h2>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => (
                  <button key={t.id} type="button" onClick={() => update('type', t.id)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${form.type === t.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Cidade *</label>
                <input className="input-field" placeholder="Ex: Arapiraca" value={form.city} onChange={e => update('city', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Estado *</label>
                <select className="input-field" value={form.state} onChange={e => update('state', e.target.value)}>
                  {BR_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Bairro</label>
              <input className="input-field" placeholder="Ex: Centro" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="card p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Nome do espaço *</label>
              <input className="input-field" placeholder="Ex: Chácara Recanto Verde" value={form.name} onChange={e => update('name', e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Use só o nome do espaço. Não coloque @, telefone, link ou endereço aqui.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Preço por diária (R$) *</label>
                <input className="input-field" type="number" min="30" placeholder="Mín. R$ 30" value={form.price_per_day} onChange={e => update('price_per_day', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Capacidade máx. *</label>
                <input className="input-field" type="number" min="1" placeholder="Ex: 20" value={form.max_capacity} onChange={e => update('max_capacity', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-400">O preço por hora poderá ser ajustado depois no painel do anfitrião.</p>
          </div>
        )}

        {step === 2 && (
          <div className="card p-5">
            <p className="text-xs text-gray-400 mb-3">Mínimo 1, máximo 10 fotos. A primeira foto é a capa do anúncio.</p>
            <div className="grid grid-cols-3 gap-2">
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
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3 text-sm">Comodidades</h2>
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
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3 text-sm">Disponibilidade</h2>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${availableDays.includes(i) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-400'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Descrição do espaço</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Descreva seu espaço..." value={form.description} onChange={e => update('description', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Não coloque contato (Instagram, telefone, link) aqui. Você fala com o cliente pelo WhatsApp após a reserva.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Regras da casa</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Ex: Proibido fumar, sem barulho após 22h..." value={form.rules} onChange={e => update('rules', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Instruções de check-in</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Ex: Ao chegar, ligar para o interfone 101..." value={form.checkin_instructions} onChange={e => update('checkin_instructions', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Só aparece pro cliente <b>depois</b> da reserva — aqui pode pôr endereço e como chegar.</p>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-3 text-sm">Resumo</h2>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li><span className="text-gray-400">Tipo:</span> {TYPES.find(t => t.id === form.type)?.label}</li>
                <li><span className="text-gray-400">Local:</span> {form.city}{form.state ? `, ${form.state}` : ''}</li>
                <li><span className="text-gray-400">Nome:</span> {form.name || '-'}</li>
                <li><span className="text-gray-400">Diária:</span> {form.price_per_day ? `R$ ${form.price_per_day}` : '-'}</li>
                <li><span className="text-gray-400">Capacidade:</span> {form.max_capacity || '-'} pessoas</li>
                <li><span className="text-gray-400">Fotos:</span> {images.length}</li>
                <li><span className="text-gray-400">Comodidades:</span> {amenities.length}</li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          {step > 0 ? (
            <button type="button" onClick={goBack} className="btn-secondary py-3 px-6">Voltar</button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={goNext} className="btn-primary flex items-center gap-2 py-3 px-6">
              Próximo <ChevronRight size={16}/>
            </button>
          ) : (
            <button type="button" onClick={handlePublish} disabled={loading} className="btn-primary flex items-center gap-2 py-3 px-6">
              {loading ? 'Publicando...' : <>Publicar espaço <Check size={16}/></>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
