export const HOST_SIGNUP_PREFILL_KEY = 'poolday_host_signup_prefill_v1'

const PREFILL_TTL_MS = 24 * 60 * 60 * 1000

const cleanText = (value, maxLength) => String(value || '').trim().slice(0, maxLength)

export function calculateHostEarnings(dailyRate, monthlyBookings) {
  const daily = Math.max(0, Number(dailyRate) || 0)
  const bookings = Math.max(0, Math.floor(Number(monthlyBookings) || 0))
  const promotionalBookings = Math.min(bookings, 3)
  const monthly = (promotionalBookings * daily) + ((bookings - promotionalBookings) * daily * 0.85)
  const yearlyBookings = bookings * 12
  const yearly = (Math.min(yearlyBookings, 3) * daily)
    + (Math.max(yearlyBookings - 3, 0) * daily * 0.85)

  return { monthly, yearly }
}

export function saveHostSignupPrefill(storage, data, now = Date.now()) {
  if (!storage) return

  const payload = {
    version: 1,
    savedAt: now,
    name: cleanText(data?.name, 100),
    phone: String(data?.phone || '').replace(/\D/g, '').slice(0, 11),
    city: cleanText(data?.city, 100),
    propertyType: cleanText(data?.propertyType, 50),
  }

  storage.setItem(HOST_SIGNUP_PREFILL_KEY, JSON.stringify(payload))
}

export function readHostSignupPrefill(storage, now = Date.now()) {
  if (!storage) return null

  try {
    const parsed = JSON.parse(storage.getItem(HOST_SIGNUP_PREFILL_KEY) || 'null')
    const isValid = parsed?.version === 1
      && Number.isFinite(parsed.savedAt)
      && now - parsed.savedAt <= PREFILL_TTL_MS
      && now >= parsed.savedAt

    if (!isValid) {
      storage.removeItem(HOST_SIGNUP_PREFILL_KEY)
      return null
    }

    return {
      name: cleanText(parsed.name, 100),
      phone: String(parsed.phone || '').replace(/\D/g, '').slice(0, 11),
      city: cleanText(parsed.city, 100),
      propertyType: cleanText(parsed.propertyType, 50),
    }
  } catch {
    storage.removeItem(HOST_SIGNUP_PREFILL_KEY)
    return null
  }
}

export function clearHostSignupPrefill(storage) {
  storage?.removeItem(HOST_SIGNUP_PREFILL_KEY)
}
