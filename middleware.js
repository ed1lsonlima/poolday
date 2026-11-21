// Guarda a cidade aproximada que a Vercel já informa em cada acesso, para a contagem de visitas.
// Só roda nas páginas: arquivos, /api e o painel ficam de fora.
export const config = { matcher: ['/((?!api/|assets/|painel|.*\\.[a-z0-9]+$).*)'] }

export default function middleware(request) {
  const parts = ['x-vercel-ip-city', 'x-vercel-ip-country-region', 'x-vercel-ip-country'].map(name => request.headers.get(name) || '')
  const headers = new Headers({ 'x-middleware-next': '1' })
  if (parts.some(Boolean)) headers.set('set-cookie', `pd_geo=${encodeURIComponent(parts.join('|'))}; Path=/; Max-Age=86400; SameSite=Lax; Secure`)
  return new Response(null, { headers })
}
