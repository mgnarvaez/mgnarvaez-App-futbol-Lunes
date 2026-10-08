import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          ⚽ Panel de Fútbol Limpio
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Base configurada y lista. Conectando con Google Sheets y Puertos 2...
        </p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
