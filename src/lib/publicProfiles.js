import { supabase } from './supabase'
export async function withReviewAuthors(reviews = []) {
  const ids = [...new Set(reviews.map(r => r.reviewer_id).filter(Boolean))]
  if (!ids.length) return reviews
  const { data } = await supabase.from('public_profiles').select('id,name,city').in('id', ids)
  const names = new Map((data || []).map(p => [p.id, p]))
  return reviews.map(r => ({ ...r, reviewer: names.get(r.reviewer_id), profiles: names.get(r.reviewer_id) }))
}
