import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>
      <h1>⚽ Panel de Fútbol Limpio</h1>
      <p>¡Base configurada correctamente en Vercel!</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
