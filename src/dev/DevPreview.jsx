import { useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AdminPanel from '../components/admin/AdminPanel'
import ReferralView from '../components/referral/ReferralView'

// Somente em desenvolvimento (import.meta.env.DEV): telas com dados fictícios, sem banco nem login.
const day = offset => new Date(Date.now() - offset * 864e5).toISOString()
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const users = [
  { id: uid(1), name: 'Dono PoolDay', email: 'dono@exemplo.test', role: 'host', city: 'Maceió', state: 'AL', verified: true, created_at: day(90) },
  { id: uid(2), name: 'Ana Anfitriã', email: 'ana@exemplo.test', role: 'host', city: 'Arapiraca', state: 'AL', created_at: day(2), phone: '82900000001' },
  { id: uid(3), name: 'Bruno Cliente', email: 'bruno@exemplo.test', role: 'client', city: 'Recife', state: 'PE', created_at: day(5) },
  { id: uid(4), name: 'Carla Indicadora', email: 'carla@exemplo.test', role: 'client', city: 'Maceió', state: 'AL', created_at: day(20) },
  { id: uid(5), name: 'Davi Chácaras', email: 'davi@exemplo.test', role: 'host', city: 'Palmeira dos Índios', state: 'AL', created_at: day(4) },
]
const properties = [
  { id: uid(11), host_id: uid(2), name: 'Piscina com deck (exemplo)', city: 'Arapiraca', state: 'AL', price_per_day: 350, moderation_status: 'pending', is_active: false, description: 'Piscina, churrasqueira e área coberta.', images: [], created_at: day(1) },
  { id: uid(12), host_id: uid(5), name: 'Chácara Sombra (exemplo)', city: 'Palmeira dos Índios', state: 'AL', price_per_day: 500, moderation_status: 'approved', is_active: true, images: [], created_at: day(3) },
  { id: uid(13), host_id: uid(1), name: 'Espaço de teste (exemplo)', city: 'Maceió', state: 'AL', price_per_day: 1, moderation_status: 'approved', is_active: false, images: [], created_at: day(40) },
]
const bookings = [
  { id: uid(21), client_id: uid(3), host_id: uid(5), property_id: uid(12), date: day(-6).slice(0, 10), status: 'confirmed', total_amount: 550, paid_amount: 550, created_at: day(2) },
  { id: uid(22), client_id: uid(3), host_id: uid(5), property_id: uid(12), date: day(-9).slice(0, 10), status: 'pending', payment_state: 'awaiting_first_payment', paid_amount: 0, total_amount: 550, hold_expires_at: day(1), created_at: day(1) },
]
const data = {
  users, properties, bookings,
  payments: [{ payment_id: '123456789', booking_id: uid(21), host_id: uid(5), status: 'approved', amount: 550, refunded_amount: 0, platform_fee: 0, host_net: 500, payment_created_at: day(2), provider_updated_at: day(2) }],
  events: [
    { id: uid(31), kind: 'signup', severity: 'info', title: 'Novo cadastro: Bruno Cliente', created_at: day(5) },
    { id: uid(32), kind: 'booking', severity: 'info', title: 'Nova tentativa de reserva', entity_id: uid(22), created_at: day(1) },
    { id: uid(33), kind: 'booking_status', severity: 'info', title: 'Reserva cancelada ou expirada', created_at: day(1) },
    { id: uid(34), kind: 'contact', severity: 'review', title: 'Possível contato externo no anúncio', entity_id: uid(11), created_at: day(1) },
  ],
  audit: [{ id: uid(41), action: 'approve_property', entity_id: uid(12), reason: 'Aprovado após revisão do anúncio.', created_at: day(3) }],
  chatReports: [],
  chatModeration: [{ id: uid(51), booking_id: uid(21), created_at: day(1) }],
  referrers: [{ user_id: uid(4), codigo: 'ab12cd34', nome: 'Carla Indicadora', whatsapp: '82900000004', chave_pix: 'carla@exemplo.test', ativo: true, created_at: day(15) }],
  referrals: [
    { id: uid(61), indicador_id: uid(4), anfitriao_id: uid(5), property_id: uid(12), status: 'a_pagar', valor_centavos: 2000, created_at: day(4), aprovada_em: day(3) },
    { id: uid(62), indicador_id: uid(4), anfitriao_id: uid(2), property_id: uid(11), status: 'aguardando_aprovacao', valor_centavos: 2000, created_at: day(2) },
  ],
  generatedAt: new Date().toISOString(), ownerId: uid(1),
}
const fake = async () => { toast.success('Pré-visualização: nada foi enviado.'); return true }

function AdminPreview() {
  const [tab, setTab] = useState('overview')
  return <AdminPanel data={data} tab={tab} onTab={setTab} busy={false} error="" onReload={async () => {}} acting={false} onAction={fake} onApprove={fake}
    onOpenProperty={async id => ({ ...properties.find(p => p.id === id), type: 'pool', max_capacity: 20, hora_inicio: 8, hora_fim: 18, available_days: [0, 6], amenities: ['Churrasqueira'], address: 'Endereço fictício' })}
    onOpenChat={async id => ({ booking: { id }, acceptances: [], messages: [{ id: 'm1', sender_id: uid(3), content: 'Olá! Chego às 9h.', created_at: day(1) }], reports: [], moderation: [{ id: 'x', kind: 'telefone', content: '[bloqueado]' }], hasMore: false })}/>
}

function ReferralPreview() {
  const [form, setForm] = useState({ nome: 'Carla Indicadora', whatsapp: '(82) 90000-0004', chave_pix: 'carla@exemplo.test' })
  return <ReferralView link="https://www.pooldaybr.com/i/ab12cd34" form={form} onChange={patch => setForm(f => ({ ...f, ...patch }))} onSave={fake} saving={false} inactive={false} onCopy={fake}
    history={[{ id: 1, anfitriao_primeiro_nome: 'Davi', status: 'a_pagar', valor_centavos: 2000, created_at: day(4) }, { id: 2, anfitriao_primeiro_nome: 'Ana', status: 'aguardando_aprovacao', valor_centavos: 2000, created_at: day(2) }]}/>
}

export default function DevPreview() {
  const { screen } = useParams()
  return screen === 'indique' ? <ReferralPreview/> : <AdminPreview/>
}
