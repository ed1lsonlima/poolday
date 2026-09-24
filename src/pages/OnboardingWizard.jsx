import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, ShieldCheck, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import CityField from '../components/common/CityField'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { buildPublicPropertyTitle, containsExternalContact, isTrustedMapLink } from '../lib/propertySafety'
import { PRESENCE_OPTIONS, presenceLabel } from '../lib/presence'

const TYPES = [
  { id: 'pool', label: 'Piscina' }, { id: 'chacara', label: 'Chácara' },
  { id: 'court', label: 'Quadra' }, { id: 'soccer', label: 'Campo de futebol' },
]
const AMENITIES = ['Piscina', 'Wi-Fi', 'Estacionamento', 'Spa', 'Toalhas', 'Drinks', 'Vista mar', 'Jardim', 'Deck', 'Churrasqueira', 'Área gourmet', 'Som ambiente', 'Projetor', 'Câmeras de segurança']
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STEPS = [
  ['Seu espaço', 'Escolha o tipo e a localização aproximada.'],
  ['Preço e funcionamento', 'Defina a diária e quando você recebe clientes.'],
  ['Fotos e comodidades', 'Mostre o espaço e o que está incluído.'],
  ['Como chegar e revisão', 'Cadastre os dados privados e confira o anúncio.'],
]
const DEFAULT_FORM = {
  type: 'pool', description: '', rules: '', checkin_instructions: '', city: '', neighborhood: '',
  address: '', landmark: '', map_url: '', state: 'AL', cep: '', price_per_day: '', max_capacity: '',
  hora_inicio: 8, hora_fim: 22, host_presence: 'host',
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function OnboardingWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const restored = useRef(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState([])
  const [amenities, setAmenities] = useState([])
  const [availableDays, setAvailableDays] = useState([0, 1, 2, 3, 4, 5, 6])
  const [newAmenity, setNewAmenity] = useState('')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [draftStatus, setDraftStatus] = useState('')
  const draftKey = user?.id ? `poolday:property-draft:v1:${user.id}` : null
  const publicTitle = buildPublicPropertyTitle({ ...form, amenities })

  useEffect(() => {
    if (!draftKey || restored.current) return
    restored.current = true
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved?.version === 1) {
        setForm(previous => ({ ...previous, ...saved.form }))
        setImages(Array.isArray(saved.images) ? saved.images : [])
        setAmenities(Array.isArray(saved.amenities) ? saved.amenities : [])
        setAvailableDays(Array.isArray(saved.availableDays) ? saved.availableDays : [0, 1, 2, 3, 4, 5, 6])
        setStep(Math.min(Number(saved.step) || 0, STEPS.length - 1))
        setDraftStatus('Rascunho recuperado')
      }
    } catch { localStorage.removeItem(draftKey) }
  }, [draftKey])

  useEffect(() => {
    if (!draftKey || !restored.current) return
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ version: 1, form, images, amenities, availableDays, step }))
      setDraftStatus('Salvo automaticamente')
    }, 350)
    return () => clearTimeout(timer)
  }, [availableDays, amenities, draftKey, form, images, step])

  function update(field, value) { setForm(previous => ({ ...previous, [field]: value })) }

  function validateStep() {
    if (step === 0 && (!form.city || !form.state)) { toast.error('Selecione a cidade e o estado.'); return false }
    if (step === 1 && Number(form.price_per_day) < 30) { toast.error('A diária mínima é R$ 30.'); return false }
    if (step === 1 && Number(form.max_capacity) < 1) { toast.error('Informe a capacidade máxima.'); return false }
    if (step === 1 && !availableDays.length) { toast.error('Escolha pelo menos um dia disponível.'); return false }
    if (step === 1 && Number(form.hora_inicio) >= Number(form.hora_fim)) { toast.error('O horário final precisa ser depois do inicial.'); return false }
    if (step === 2 && !images.length) { toast.error('Adicione pelo menos uma foto.'); return false }
    if (step === 3 && form.description.trim().length < 40) { toast.error('Escreva uma descrição com pelo menos 40 caracteres.'); return false }
    if (step === 3 && [form.description, form.rules, ...amenities].some(containsExternalContact)) { toast.error('Retire telefone, @, rede social ou link dos campos públicos.'); return false }
    if (step === 3 && (!form.address.trim() || !form.landmark.trim() || form.checkin_instructions.trim().length < 15)) { toast.error('Preencha endereço, ponto de referência e instruções de chegada.'); return false }
    if (step === 3 && !isTrustedMapLink(form.map_url.trim())) { toast.error('Use um link válido do Google Maps ou Waze.'); return false }
    return true
  }

  function goNext() { if (validateStep()) setStep(current => Math.min(current + 1, STEPS.length - 1)) }
  function goBack() { setStep(current => Math.max(current - 1, 0)) }

  async function uploadImage(file) {
    if (!file) return
    if (images.length >= 10) { toast.error('Você pode enviar até 10 fotos.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Use JPG, PNG ou WebP.'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('A foto deve ter no máximo 10 MB.'); return }
    setUploading(true)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from('property-images').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(path)
      setImages(previous => [...previous, publicUrl])
      toast.success('Foto adicionada!')
    } catch { toast.error('Não foi possível enviar a foto.') }
    finally { setUploading(false) }
  }

  function chooseCover(index) {
    setImages(previous => [previous[index], ...previous.filter((_, itemIndex) => itemIndex !== index)])
  }

  function toggleAmenity(item) {
    setAmenities(previous => previous.includes(item) ? previous.filter(value => value !== item) : [...previous, item])
  }

  function addCustomAmenity() {
    const value = newAmenity.trim()
    if (!value) return
    if (value.localeCompare('Churrasco', 'pt-BR', { sensitivity: 'base' }) === 0) { toast.error('Use a opção “Churrasqueira”.'); return }
    if (containsExternalContact(value)) { toast.error('Não coloque contato ou link nas comodidades.'); return }
    if ([...AMENITIES, ...amenities].some(item => item.localeCompare(value, 'pt-BR', { sensitivity: 'base' }) === 0)) { toast.error('Essa comodidade já está na lista.'); return }
    setAmenities(previous => [...previous, value])
    setNewAmenity('')
  }

  function toggleDay(day) {
    setAvailableDays(previous => previous.includes(day) ? previous.filter(value => value !== day) : [...previous, day])
  }

  async function handlePublish() {
    if (!validateStep()) return
    setLoading(true)
    try {
      const { municipality_code: _municipalityCode, ...propertyForm } = form
      const payload = {
        ...propertyForm, name: publicTitle, images, amenities, available_days: availableDays,
        host_id: user.id, is_active: false, price_per_hour: null,
        max_capacity: Number(form.max_capacity), price_per_day: Number(form.price_per_day),
        hora_inicio: Number(form.hora_inicio), hora_fim: Number(form.hora_fim), map_url: form.map_url.trim() || null,
      }
      const { error } = await supabase.from('properties').insert(payload)
      if (error) throw error
      if (draftKey) localStorage.removeItem(draftKey)
      toast.success('Espaço enviado para análise!')
      navigate('/anfitriao')
    } catch (error) {
      toast.error(error?.message?.includes('CONTATO_EXTERNO') ? 'Encontramos contato ou link em uma informação pública.' : 'Não foi possível enviar para análise. Tente novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-5">
          <button onClick={() => step === 0 ? navigate('/anfitriao') : goBack()} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800"><ChevronLeft size={19}/>Voltar</button>
          {draftStatus ? <span className="text-xs text-gray-400">{draftStatus}</span> : null}
        </div>
        <div className="flex gap-2 mb-3" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((item, index) => <div key={item[0]} className={`h-2 flex-1 rounded-full ${index <= step ? 'bg-primary-500' : 'bg-gray-200'}`}/>)}
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary-500">Passo {step + 1} de {STEPS.length}</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">{STEPS[step][0]}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">{STEPS[step][1]}</p>

        {step === 0 ? <SpaceStep form={form} update={update} setForm={setForm} title={publicTitle}/> : null}
        {step === 1 ? <ScheduleStep form={form} update={update} availableDays={availableDays} toggleDay={toggleDay}/> : null}
        {step === 2 ? <MediaStep images={images} setImages={setImages} uploading={uploading} uploadImage={uploadImage} chooseCover={chooseCover} amenities={amenities} toggleAmenity={toggleAmenity} newAmenity={newAmenity} setNewAmenity={setNewAmenity} addCustomAmenity={addCustomAmenity}/> : null}
        {step === 3 ? <ReviewStep form={form} update={update} title={publicTitle} images={images} amenities={amenities}/> : null}

        <div className="flex justify-between gap-3 mt-6">
          {step > 0 ? <button type="button" onClick={goBack} className="btn-secondary py-3 px-5">Voltar</button> : <div/>}
          {step < STEPS.length - 1
            ? <button type="button" onClick={goNext} className="btn-primary flex items-center gap-2 py-3 px-6">Continuar <ChevronRight size={17}/></button>
            : <button type="button" onClick={handlePublish} disabled={loading || uploading} className="btn-primary flex items-center gap-2 py-3 px-6">{loading ? 'Enviando...' : <>Enviar para análise <Check size={17}/></>}</button>}
        </div>
      </div>
    </div>
  )
}

function SpaceStep({ form, update, setForm, title }) {
  return <div className="card p-5 sm:p-7 space-y-5">
    <div><h2 className="font-bold text-gray-800 mb-3 text-sm">Qual espaço você oferece?</h2><div className="grid grid-cols-2 gap-2">{TYPES.map(type => <button key={type.id} type="button" onClick={() => update('type', type.id)} className={`p-3 rounded-xl border-2 text-sm font-semibold ${form.type === type.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>{type.label}</button>)}</div></div>
    <CityField value={form} onChange={location => setForm(previous => ({ ...previous, ...location }))} required label="Cidade e estado" description="A cidade será usada nas buscas."/>
    <div><label className="text-sm font-semibold text-gray-700 mb-1.5 block">Bairro <span className="font-normal text-gray-400">(opcional)</span></label><input className="input-field" placeholder="Ex.: Ponta Verde" value={form.neighborhood} onChange={event => update('neighborhood', event.target.value)}/></div>
    <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4"><div className="flex items-start gap-3"><ShieldCheck className="text-primary-600 shrink-0" size={21}/><div><p className="text-xs font-bold uppercase text-primary-600">Título criado pelo PoolDay</p><p className="font-bold text-gray-900 mt-1">{title}</p><p className="text-xs text-gray-600 mt-1">O título usa apenas o tipo, o bairro e características selecionadas.</p></div></div></div>
  </div>
}

function ScheduleStep({ form, update, availableDays, toggleDay }) {
  return <div className="space-y-4">
    <div className="card p-5 sm:p-7 space-y-5"><div className="grid sm:grid-cols-2 gap-4"><div><label className="text-sm font-semibold text-gray-700 mb-1.5 block">Valor da diária *</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">R$</span><input className="input-field pl-10" type="number" min="30" inputMode="decimal" placeholder="300" value={form.price_per_day} onChange={event => update('price_per_day', event.target.value)}/></div></div><div><label className="text-sm font-semibold text-gray-700 mb-1.5 block">Capacidade máxima *</label><input className="input-field" type="number" min="1" inputMode="numeric" placeholder="Ex.: 20" value={form.max_capacity} onChange={event => update('max_capacity', event.target.value)}/></div></div>{Number(form.price_per_day) >= 30 ? <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-emerald-800">Nas 3 primeiras reservas</span><b className="text-emerald-700">Você recebe R$ {money(form.price_per_day)}</b></div><p className="text-xs text-emerald-700/80 mt-1">Taxa zero na promoção de lançamento. Depois, a taxa padrão é 15%.</p></div> : null}</div>
    <div className="card p-5 sm:p-7"><div className="flex items-center gap-2 mb-3"><Clock3 size={19} className="text-primary-500"/><h2 className="font-bold text-gray-800">Dias e horário da diária</h2></div><div className="flex gap-2 flex-wrap">{DAYS.map((day, index) => <button key={day} type="button" onClick={() => toggleDay(index)} className={`min-w-11 px-3 py-2 rounded-xl text-sm font-semibold border-2 ${availableDays.includes(index) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-400'}`}>{day}</button>)}</div><div className="flex items-center gap-2 flex-wrap mt-5"><span className="text-sm text-gray-500">A diária vai das</span><HourSelect value={form.hora_inicio} onChange={value => update('hora_inicio', value)}/><span className="text-sm text-gray-500">às</span><HourSelect value={form.hora_fim} onChange={value => update('hora_fim', value)}/></div></div>
    <div className="card p-5 sm:p-7"><h2 className="font-bold text-gray-800">Quem recebe o cliente?</h2><p className="text-sm text-gray-500 mt-1 mb-4">Escolha o padrão do espaço. Você poderá alterar para datas específicas no calendário, antes que alguém reserve.</p><div className="space-y-2">{PRESENCE_OPTIONS.map(option => <label key={option.value} className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 cursor-pointer"><input type="radio" name="host_presence" checked={form.host_presence === option.value} onChange={() => update('host_presence', option.value)}/>{option.label}</label>)}</div></div>
  </div>
}

function HourSelect({ value, onChange }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="input-field w-auto py-2">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}h</option>)}</select>
}

function MediaStep({ images, setImages, uploading, uploadImage, chooseCover, amenities, toggleAmenity, newAmenity, setNewAmenity, addCustomAmenity }) {
  return <div className="space-y-4">
    <div className="card p-5 sm:p-7"><div className="flex items-center gap-2 mb-2"><Camera size={20} className="text-primary-500"/><h2 className="font-bold text-gray-800">Fotos do espaço *</h2></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-xs text-amber-900 leading-relaxed"><b>Importante:</b> não envie fotos nem vídeos com o nome comercial do espaço, placa, telefone, WhatsApp, @ de rede social, QR Code, link ou marca-d’água. Esse conteúdo não será aprovado.</div><div className="grid sm:grid-cols-3 gap-2 text-xs text-gray-500 mb-4"><span>✓ Use boa iluminação</span><span>✓ Mostre a área inteira</span><span>✓ Recomendamos 3 ou mais fotos</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{images.map((image, index) => <div key={image} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"><img src={image} alt={`Foto ${index + 1} do espaço`} className="w-full h-full object-cover"/><button type="button" onClick={() => setImages(previous => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover foto" className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"><X size={15} className="text-red-500"/></button>{index === 0 ? <span className="absolute bottom-2 left-2 bg-black/65 text-white text-xs px-2 py-1 rounded-full">Capa</span> : <button type="button" onClick={() => chooseCover(index)} className="absolute bottom-2 left-2 bg-white/95 text-gray-700 text-[11px] font-semibold px-2 py-1 rounded-full shadow">Usar como capa</button>}</div>)}{images.length < 10 ? <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50">{uploading ? <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"/> : <><Upload size={22} className="text-gray-400 mb-1"/><span className="text-xs font-semibold text-gray-500">Adicionar foto</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => uploadImage(event.target.files?.[0])} disabled={uploading}/></label> : null}</div></div>
    <div className="card p-5 sm:p-7"><h2 className="font-bold text-gray-800 mb-3">O que está incluído?</h2><div className="flex flex-wrap gap-2 mb-4">{AMENITIES.map(item => <button key={item} type="button" onClick={() => toggleAmenity(item)} className={`px-3 py-2 rounded-full text-sm border-2 ${amenities.includes(item) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>{amenities.includes(item) ? '✓ ' : ''}{item}</button>)}</div><div className="flex gap-2"><input className="input-field flex-1" placeholder="Outra comodidade" value={newAmenity} onChange={event => setNewAmenity(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomAmenity() } }}/><button type="button" onClick={addCustomAmenity} aria-label="Adicionar comodidade" className="bg-primary-500 text-white px-4 rounded-xl"><Plus size={17}/></button></div></div>
  </div>
}

function ReviewStep({ form, update, title, images, amenities }) {
  return <div className="space-y-4">
    <div className="card p-5 sm:p-7 space-y-5"><div><label className="text-sm font-semibold text-gray-700 mb-1.5 block">Descrição pública *</label><textarea className="input-field resize-y min-h-32" maxLength={1200} placeholder="Conte como é o espaço e o que torna a experiência especial." value={form.description} onChange={event => update('description', event.target.value)}/><div className="flex justify-between text-xs mt-1"><span className={form.description.trim().length >= 40 ? 'text-emerald-600' : 'text-gray-400'}>{form.description.trim().length >= 40 ? 'Descrição pronta ✓' : 'Mínimo de 40 caracteres'}</span><span className="text-gray-400">{form.description.length}/1200</span></div></div><div><label className="text-sm font-semibold text-gray-700 mb-1.5 block">Regras <span className="font-normal text-gray-400">(opcional)</span></label><textarea className="input-field resize-y min-h-24" maxLength={700} placeholder="Ex.: não é permitido som alto após as 22h." value={form.rules} onChange={event => update('rules', event.target.value)}/></div></div>
    <div className="card p-5 sm:p-7 space-y-4"><div className="flex items-start gap-3"><MapPin size={21} className="text-primary-500 shrink-0 mt-0.5"/><div><h2 className="font-bold text-gray-900">Como o cliente encontra o local</h2><p className="text-xs text-gray-500 mt-1">Essas informações são privadas e só aparecem depois que o pagamento for confirmado. Cadastre detalhes claros, principalmente para sítios e locais afastados.</p></div></div><div className="grid sm:grid-cols-[1fr_140px] gap-3"><PrivateField label="Endereço completo *" value={form.address} onChange={value => update('address', value)} placeholder="Rua/estrada, número e complemento"/><PrivateField label="CEP" value={form.cep} onChange={value => update('cep', value)} placeholder="00000-000"/></div><PrivateField label="Ponto de referência *" value={form.landmark} onChange={value => update('landmark', value)} placeholder="Ex.: portão azul, 500 m depois da igreja"/><PrivateField label="Link do Google Maps ou Waze" value={form.map_url} onChange={value => update('map_url', value)} placeholder="Cole aqui o link da localização exata"/><div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Instruções para chegar e entrar *</label><textarea className="input-field resize-y min-h-24" placeholder="Explique a estrada de acesso, entrada correta, portão, interfone e quem recebe o cliente." value={form.checkin_instructions} onChange={event => update('checkin_instructions', event.target.value)}/></div><div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800"><b>Proteção de privacidade:</b> bairro e cidade aparecem no anúncio; endereço, mapa, referência e instruções só são liberados ao cliente com reserva paga.</div></div>
    <div className="card p-5 sm:p-7"><h2 className="font-bold text-gray-800 mb-3">Confira seu anúncio</h2><div className="rounded-xl bg-primary-50 p-4 mb-4"><p className="text-xs font-bold uppercase text-primary-600">Título público</p><p className="font-bold text-gray-900 mt-1">{title}</p></div><dl className="grid sm:grid-cols-2 gap-3 text-sm"><Summary label="Local aproximado" value={[form.neighborhood, form.city, form.state].filter(Boolean).join(', ')}/><Summary label="Diária" value={`R$ ${money(form.price_per_day)}`}/><Summary label="Horário" value={`${String(form.hora_inicio).padStart(2, '0')}h às ${String(form.hora_fim).padStart(2, '0')}h`}/><Summary label="Recepção" value={presenceLabel(form.host_presence)}/><Summary label="Conteúdo" value={`${images.length} foto(s) · ${amenities.length} item(ns)`}/></dl><div className="flex items-start gap-2 text-xs text-gray-500 border-t mt-4 pt-4"><ShieldCheck size={17} className="text-primary-500 shrink-0"/><p>O anúncio será revisado. Foto ou texto com contato, marca, QR Code ou instrução para reservar por fora será recusado.</p></div></div>
  </div>
}

function PrivateField({ label, value, onChange, placeholder }) {
  return <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{label}</label><input className="input-field" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/></div>
}

function Summary({ label, value }) {
  return <div><dt className="text-gray-400">{label}</dt><dd className="font-semibold text-gray-700">{value}</dd></div>
}

