import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PropertyCard from '../components/common/PropertyCard'
import { MapPin, Star, ShieldCheck, Calendar } from 'lucide-react'

export default function HostProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [host, setHost] = useState(null)
  const [properties, setProperties] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchHost() }, [id])

  async function fetchHost() {
    setLoading(true)
    const { data: hostData } = await supabase.from('profiles').select('*').eq('id', id).eq('role', 'host').single()
    if (!hostData) { navigate('/'); return }
    setHost(hostData)

    const { data: props } = await supabase.from('properties').select('*').eq('host_id', id).eq('is_active', true).order('created_at', { ascending: false })
    setProperties(props || [])

    if (props?.length) {
      const propertyIds = props.map(p => p.id)
      const { data: reviewData } = await supabase.from('reviews').select('rating, comment, created_at, profiles(name)').in('property_id', propertyIds).order('created_at', { ascending: false })
      setReviews(reviewData || [])
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )
  if (!host) return null

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const memberSince = new Date(host.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="card p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold shrink-0 overflow-hidden">
              {host.avatar_url ? <img src={host.avatar_url} alt={host.name} className="w-full h-full object-cover" /> : host.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-800">{host.name}</h1>
                {host.verified && (
                  <span className="flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <ShieldCheck size={13} /> Verificado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1.5">
                {host.city && <span className="flex items-center gap-1"><MapPin size={14} />{host.city}</span>}
                <span className="flex items-center gap-1"><Calendar size={14} />Anfitriao desde {memberSince}</span>
              </div>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Star size={16} className="text-orange-500 fill-orange-500" />
                  <span className="font-semibold text-gray-800">{avgRating.toFixed(1)}</span>
                  <span className="text-gray-500 text-sm">({reviews.length} avaliacoes)</span>
                </div>
              )}
            </div>
          </div>
          {host.bio && <p className="text-gray-600 text-sm leading-relaxed mt-5 pt-5 border-t border-gray-100">{host.bio}</p>}
        </div>

        <div className="mb-8">
          <h2 className="font-bold text-gray-800 mb-4">Espacos de {host.name.split(' ')[0]}</h2>
          {properties.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum espaco ativo no momento.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-bold text-gray-800 mb-4">Avaliacoes</h2>
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma avaliacao ainda.</p>
          ) : (
            <div className="space-y-4">
              {reviews.slice(0, 10).map((r, i) => (
                <div key={i} className="card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800 text-sm">{r.profiles?.name || 'Hospede'}</span>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-orange-500 fill-orange-500" />
                      <span className="text-sm font-medium">{r.rating}</span>
                    </div>
                  </div>
                  {r.comment && <p className="text-gray-600 text-sm leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
