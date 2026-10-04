export function filterCities(cities, query, limit = 20) {
  const normalized = String(query || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  if (!normalized) return cities.slice(0, limit)
  return cities.filter(city => String(city.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized)).slice(0, limit)
}
