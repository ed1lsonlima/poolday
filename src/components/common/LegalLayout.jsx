import BackButton from './BackButton'

export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <BackButton className="mb-5" />
        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">{title}</h1>
          {updated && <p className="text-xs text-gray-400 mb-6">Última atualização: {updated}</p>}
          <div className="prose prose-sm max-w-none text-gray-600 space-y-4 leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mt-6 [&_h2]:mb-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

