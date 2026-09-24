export const PRESENCE_OPTIONS = [
  { value: 'host', label: 'O anfitrião estará no local' },
  { value: 'representative', label: 'Um responsável estará no local' },
  { value: 'self_checkin', label: 'Acesso sem anfitrião no local' },
]

export function presenceLabel(value) {
  return PRESENCE_OPTIONS.find(option => option.value === value)?.label || 'Recepção a confirmar'
}

