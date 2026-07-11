import { Component } from 'react'

// Evita a "tela branca da morte": se qualquer componente quebrar,
// o usuário vê uma mensagem amigável em vez de uma página em branco.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Erro capturado pelo ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center text-center px-4">
          <div>
            <p className="text-5xl mb-4">😵‍💫</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Ops, algo deu errado</h1>
            <p className="text-gray-500 mb-6">Já estamos cientes. Tente recarregar a página.</p>
            <button onClick={() => window.location.reload()} className="btn-primary text-sm">Recarregar</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
