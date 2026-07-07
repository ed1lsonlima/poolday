import { Link } from 'react-router-dom'
import { MapPin, Star, Users } from 'lucide-react'

const typeLabels = {
  pool: 'Piscina', chacara: 'Chácara', gourmet: 'Espaço Gourmet',
  court: 'Quadra', soccer: 'Campo de Futebol', futevolei: 'Quadra de Futevôlei'
}

export default function PropertyCard({ property }) {
  const image = property.images?.[0] || 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=400&q=80'
  const rating = property.reviews_avg || 0
  const reviewCount = property.reviews_count || 0

  return (
    <Link to={`/espaco/${property.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl aspect-[4/3] mb-3">
        <img src={image} alt={property.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-gray-700">
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
          <span className="font-bold text-gray-900">R$ {Number(property.price_per_day || property.price_per_hour).toLocaleString('pt-BR')}</span>
          <span className="text-gray-500 text-sm"> /diária</span>
        </div>
      </div>
    </Link>
  )
}
