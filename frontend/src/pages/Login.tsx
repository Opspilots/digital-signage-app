import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { login } from '../auth'

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = (location.state as { from?: string })?.from ?? '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Panel izquierdo */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 relative overflow-hidden p-10"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <span style={{ color: 'var(--cyan)', fontSize: 22 }}>▣</span>
            <span className="font-display font-700 tracking-wide" style={{ color: 'var(--text1)', fontSize: 15 }}>SignageOS</span>
          </div>
        </div>

        <div className="relative z-10">
          <p className="font-display font-700 leading-tight mb-4" style={{ fontSize: 38, color: 'var(--text1)', letterSpacing: '-0.02em' }}>
            Controla tus<br />
            <span style={{ color: 'var(--cyan)' }}>pantallas</span><br />
            desde cualquier lugar.
          </p>
          <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
            Gestiona playlists, programa contenido y monitorea tus pantallas en tiempo real.
          </p>
        </div>

        <div className="relative z-10 flex gap-6">
          {[['Pantallas', 'Conectadas'], ['Playlists', 'Activas'], ['Programas', 'En curso']].map(([label, sub]) => (
            <div key={label}>
              <p className="font-display font-600 text-2xl" style={{ color: 'var(--cyan)' }}>—</p>
              <p className="text-xs mt-0.5 font-500" style={{ color: 'var(--text1)' }}>{label}</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <span style={{ color: 'var(--cyan)' }}>▣</span>
            <span className="font-display font-700 text-base tracking-wide">SignageOS</span>
          </div>

          <h2 className="font-display font-700 text-2xl mb-1" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>
            Iniciar sesión
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text2)' }}>Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-500 mb-1.5" style={{ color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Usuario
              </label>
              <input className="ds-input" type="text" autoFocus autoComplete="username"
                value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs font-500 mb-1.5" style={{ color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Contraseña
              </label>
              <input className="ds-input" type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="ds-btn w-full" style={{ marginTop: 8, padding: '10px 16px', fontSize: 14 }}>
              {loading ? 'Ingresando…' : 'Entrar →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
