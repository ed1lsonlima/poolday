const TYPE_LABELS = {
  pool: 'Piscina',
  chacara: 'Chácara',
  court: 'Quadra',
  soccer: 'Campo de futebol',
}

const EXTERNAL_CONTACT_RE = /@|\b(?:instagram|insta|whats(?:app)?|zap|facebook|tiktok|telegram|direct|dm)\b|(?:https?:\/\/|www\.|wa\.me|t\.me|\.com(?:\.br)?\b)|(?:\d[-\s().+]*){8,}/i

const TITLE_FEATURES = ['Piscina', 'Churrasqueira', 'Deck', 'Jardim', 'Estacionamento', 'Piscina infantil', 'Spa', 'Vista mar', 'Área gourmet', 'Projetor']

export function containsExternalContact(value = '') {
  return EXTERNAL_CONTACT_RE.test(String(value).normalize('NFKC'))
}

export function buildPublicPropertyTitle({ type, city, neighborhood, amenities = [] } = {}) {
  const kind = TYPE_LABELS[type] || 'Espaço para lazer'
  const features = TITLE_FEATURES.filter(feature => {
    if (type === 'pool' && feature === 'Piscina') return false
    return amenities.some(item => item?.localeCompare(feature, 'pt-BR', { sensitivity: 'base' }) === 0)
  }).slice(0, 2).map(feature => feature.toLocaleLowerCase('pt-BR'))
  const featureText = features.length === 2 ? ` com ${features[0]} e ${features[1]}` : features.length === 1 ? ` com ${features[0]}` : ''
  const location = [neighborhood?.trim(), city?.trim()].filter(Boolean).join(', ')
  return `${kind}${featureText}${location ? ` em ${location}` : ''}`
}

export function publicFirstName(name = '') {
  const clean = String(name).trim()
  if (!clean || containsExternalContact(clean)) return 'Anfitrião'
  return clean.split(/\s+/)[0]
}

export function isTrustedMapLink(value = '') {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /(^|\.)(google\.[a-z.]+|goo\.gl|waze\.com)$/i.test(url.hostname)
  } catch { return false }
}

export const PROPERTY_TYPE_LABELS = TYPE_LABELS
