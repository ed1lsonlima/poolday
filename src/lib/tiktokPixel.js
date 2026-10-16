// Only fixed event labels are sent. Never pass form fields or auth data to TikTok.
function track(event) {
  try {
    if (typeof window === 'undefined' || typeof window.ttq?.track !== 'function') return false
    window.ttq.track(event)
    return true
  } catch {
    // A blocked or failing analytics SDK must never interrupt signup.
    return false
  }
}

export function trackHostLead() {
  return track('SubmitForm')
}

const trackedRegistrations = new Set()

export function trackHostRegistration(result, role) {
  const user = result?.user
  // Supabase can return an obfuscated user for an existing email; require
  // an actual new identity. This measures account creation, not email confirmation.
  if (result?.error || role !== 'host' || !user?.id || !user.identities?.length) return false
  if (trackedRegistrations.has(user.id)) return false
  if (!track('CompleteRegistration')) return false
  trackedRegistrations.add(user.id)
  return true
}
