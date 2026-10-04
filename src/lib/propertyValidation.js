import { containsExternalContact, isTrustedMapLink } from './propertySafety.js'

export function propertyStepError(step, { form, images, amenities, availableDays }) {
  if (step === 0 && (!form.city?.trim() || !form.state)) return 'Selecione a cidade e o estado.'
  if (step === 1) {
    if (!Number.isFinite(Number(form.price_per_day)) || Number(form.price_per_day) < 30) return 'A diária mínima é R$ 30.'
    if (!Number.isInteger(Number(form.max_capacity)) || Number(form.max_capacity) < 1) return 'Informe a capacidade máxima em pessoas.'
    if (!availableDays.length) return 'Escolha pelo menos um dia disponível.'
    const start = Number(form.hora_inicio), end = Number(form.hora_fim)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 23 || start >= end) return 'O horário final precisa ser depois do inicial.'
  }
  if (step === 2 && !images.length) return 'Adicione pelo menos uma foto.'
  if (step === 3) {
    if (!form.description?.trim()) return 'Conte brevemente como é o espaço.'
    if ([form.description, form.rules, ...amenities].some(value => containsExternalContact(value || ''))) return 'Retire telefone, @, rede social ou link dos campos públicos.'
    if (!form.address?.trim()) return 'Informe o endereço completo do espaço.'
    if (!isTrustedMapLink(form.map_url?.trim())) return 'Confira o link em “Mais detalhes de localização” ou deixe esse campo vazio.'
  }
  return null
}

export function propertyFormError(data) {
  for (let step = 0; step < 4; step++) {
    const message = propertyStepError(step, data)
    if (message) return { step, message }
  }
  return null
}
