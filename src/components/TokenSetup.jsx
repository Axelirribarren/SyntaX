import { useState } from 'react'
import { getToken, setToken } from '../api/github'

export default function TokenSetup() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(getToken())

  function save() {
    setToken(value.trim())
    setOpen(false)
  }

  return (
    <div className="token-setup">
      <button className="link-btn" onClick={() => setOpen((o) => !o)}>
        {getToken() ? '🔑 Token configurado' : '🔑 Configurar GitHub Token'}
      </button>
      {open && (
        <div className="token-popover">
          <p>
            Sin token, GitHub limita a 60 búsquedas/hora. Con un{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
              Personal Access Token
            </a>{' '}
            (sin permisos, solo lectura pública) sube a 30/min. Se guarda solo en tu navegador.
          </p>
          <input
            type="password"
            placeholder="ghp_..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="token-actions">
            <button onClick={save}>Guardar</button>
            <button
              onClick={() => {
                setValue('')
                setToken('')
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
