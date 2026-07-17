import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Star, Users } from 'lucide-react'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=400&q=80'

const typeLabels = {
  pool: 'Piscina', chacara: 'Chácara', gourmet: 'Espaço Gourmet',
  court: 'Quadra', soccer: 'Campo de Futebol', futevolei: 'Quadra de Futevôlei'
}

export default function PropertyCard({ property }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const image = (!failed && property.images?.[0]) || FALLBACK_IMAGE
  const rating = property.reviews_avg || 0
  const reviewCount = property.reviews_count || 0

  // Antes o card sempre escrevia "/diária", mesmo quando o valor exibido
  // era o preço por hora. Agora o rótulo acompanha o valor mostrado.
  const hasDaily = Number(property.price_per_day) > 0
  const price = hasDaily ? property.price_per_day : property.price_per_hour
  const priceLabel = hasDaily ? '/diária' : '/hora'

  return (
    <Link to={`/espaco/${property.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl aspect-[4/3] mb-3 bg-gray-100">
        {/* Placeholder enquanto a foto carrega — evita o card "pulando" */}
        {!loaded && <div className="absolute inset-0 skeleton" />}
        <img
          src={image}
          alt={property.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => { setFailed(true); setLoaded(true) }}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
          {typeLabels[property.type] || property.type}
        </div>
      </div>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-800 group-hover:text-primary-500 transition-colors line-clamp-1">{property.name}</h3>
          {reviewCount > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
          <MapPin size={13} />
          <span>{property.city}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-sm mt-0.5">
          <Users size={13} />
          <span>Até {property.max_capacity} pessoas</span>
        </div>
        <div className="mt-2">
          <span className="font-bold text-gray-900">
            R$ {Number(price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-gray-500 text-sm"> {priceLabel}</span>
        </div>
      </div>
    </Link>
  )
}
