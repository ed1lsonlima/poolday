import { useNavigate } from 'react-router-dom'
import { Search, Home } from 'lucide-react'

export default function HostWelcome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">O que voce quer fazer no PoolDay?</h1>
        <p className="text-gray-500 text-sm mb-8">Voce pode fazer os dois depois, mas vamos comecar por um.</p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/explorar')}
            className="w-full flex items-center gap-3 border-2 border-gray-200 rounded-xl py-4 px-5 hover:border-gray-300 transition-all text-left"
          >
            <Search size={20} className="text-gray-500 shrink-0" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Quero alugar um espaco</p>
              <p className="text-xs text-gray-400">Buscar piscinas e chacaras por hora ou diaria</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/anfitriao/cadastrar-espaco')}
            className="w-full flex items-center gap-3 border-2 border-primary-500 bg-primary-50 rounded-xl py-4 px-5 hover:bg-primary-100 transition-all text-left"
          >
            <Home size={20} className="text-primary-600 shrink-0" />
            <div>
              <p className="font-semibold text-primary-700 text-sm">Quero anunciar meu espaco</p>
              <p className="text-xs text-primary-500">Cadastrar sua piscina ou chacara em poucos passos</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
