import { Link } from 'react-router-dom'
import { Waves } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-6 mt-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Waves className="text-primary-400" size={24} />
              <span className="font-bold text-white text-lg">PoolDay</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Alugue piscinas e espaços incríveis por diária. A melhor experiência aquática te espera.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="https://instagram.com/pooldaybr" target="_blank" rel="noreferrer"
                className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary-500 transition-colors text-sm font-bold">
                IG
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Explorar</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/explorar" className="hover:text-white transition-colors">Piscinas</Link></li>
              <li><Link to="/explorar" className="hover:text-white transition-colors">Como funciona</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Anfitrião</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/cadastro?role=host" className="hover:text-white transition-colors">Anuncie seu espaço</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/acordo-anfitriao" className="hover:text-white transition-colors">Acordo do Anfitrião</Link></li>
              <li><Link to="/cancelamento" className="hover:text-white transition-colors">Política de Cancelamento</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} PoolDay. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}
