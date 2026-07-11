import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-center px-4">
      <div>
        <p className="text-6xl mb-4">🏊</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Página não encontrada</h1>
        <p className="text-gray-500 mb-6">Essa piscina não existe... mas temos várias outras esperando por você.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="btn-secondary text-sm">Voltar ao início</Link>
          <Link to="/explorar" className="btn-primary text-sm">Explorar espaços</Link>
        </div>
      </div>
    </div>
  )
}
