export function bearerToken(req) {
  const value = req.headers.authorization || ''
  return typeof value === 'string' ? /^Bearer ([^\s]+)$/i.exec(value)?.[1] : null
}

export async function requireUser(req, res, supabase) {
  const token = bearerToken(req)
  if (!token) {
    res.status(401).json({ error: 'Faça login para continuar.' })
    return null
  }
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' })
    return null
  }
  return data.user
}

