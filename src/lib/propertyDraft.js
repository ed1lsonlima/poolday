export const propertyDraftKey = userId => `poolday:property-draft:v1:${userId}`

export function loadPropertyDraft(storage, userId) {
  if (!storage || !userId) return null
  try {
    const saved = JSON.parse(storage.getItem(propertyDraftKey(userId)) || 'null')
    return saved?.version === 1 && saved.form ? saved : null
  } catch { return null }
}

export function savePropertyDraft(storage, userId, draft) {
  if (!storage || !userId) return false
  try {
    storage.setItem(propertyDraftKey(userId), JSON.stringify({ version: 1, ...draft, savedAt: new Date().toISOString() }))
    return true
  } catch { return false }
}

export function clearPropertyDraft(storage, userId) {
  try { storage?.removeItem(propertyDraftKey(userId)) } catch { /* storage indisponível */ }
}
