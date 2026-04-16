import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { screenApi } from '../api/client'

const POLL_MS = 3000

export default function PairingScreen() {
  const navigate = useNavigate()
  const [code, setCode]         = useState<string | null>(null)
  const [token, setToken]       = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [claimed, setClaimed]   = useState(false)
  const [screenName, setScreenName] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    screenApi.pairNew()
      .then((r) => {
        setCode(r.code)
        setToken(r.token)
        try { localStorage.setItem('signage:screen_token', r.token) } catch {}
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (!token || claimed) return
    const poll = () => {
      screenApi.pairStatus(token)
        .then((s) => {
          if (s.claimed) {
            setClaimed(true)
            setScreenName(s.name)
          }
        })
        .catch(() => { /* ignore polling errors */ })
    }
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [token, claimed])

  // Once claimed, heartbeat to discover the assigned playlist and redirect.
  useEffect(() => {
    if (!claimed || !token) return
    let cancelled = false
    const tick = () => {
      screenApi.heartbeat(token)
        .then((data) => {
          if (cancelled) return
          if (data.current_playlist_id) {
            navigate(`/playlists/${data.current_playlist_id}/play?screen=${token}`, { replace: true })
          }
        })
        .catch(() => {})
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [claimed, token, navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-red-400 p-6 text-center">
        <div>
          <p className="mb-2">No se pudo solicitar el código de emparejamiento.</p>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (claimed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center gap-3">
        <div className="text-5xl">✓</div>
        <p className="font-display font-700 text-2xl">{screenName ?? 'Pantalla enlazada'}</p>
        <p className="text-gray-400 text-sm">Esperando a que asignes una lista de reproducción…</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{ background: 'radial-gradient(circle at 30% 20%, #0d1219 0%, #07090f 60%)' }}
    >
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-lg">
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--cyan)', fontSize: 28 }}>▣</span>
          <span className="font-display font-700 text-lg tracking-wide" style={{ color: 'var(--text1)' }}>SignageOS</span>
        </div>

        <div>
          <p className="text-xs font-500 uppercase tracking-widest mb-3" style={{ color: 'var(--text2)', letterSpacing: '0.2em' }}>
            Código de emparejamiento
          </p>
          <div
            className="font-display font-700 select-all"
            style={{
              fontSize: 'clamp(48px, 16vw, 140px)',
              letterSpacing: '0.1em',
              color: 'var(--cyan)',
              textShadow: '0 0 40px rgba(34,211,238,0.4)',
              lineHeight: 1,
            }}
          >
            {code ? code.match(/.{1,3}/g)?.join('  ') : '– – – – – –'}
          </div>
        </div>

        <div className="ds-card px-6 py-5 text-left max-w-md w-full">
          <p className="text-sm mb-2" style={{ color: 'var(--text1)' }}>Para vincular esta pantalla:</p>
          <ol className="space-y-1.5 text-sm" style={{ color: 'var(--text2)' }}>
            <li>1. Abre el panel de control en otro dispositivo.</li>
            <li>2. En <strong style={{ color: 'var(--text1)' }}>Pantallas</strong>, pulsa <strong style={{ color: 'var(--text1)' }}>Enlazar por código</strong>.</li>
            <li>3. Introduce el código y dale un nombre.</li>
          </ol>
        </div>

        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          {code ? 'El código caduca en 15 minutos. Se actualizará al recargar.' : 'Solicitando código…'}
        </p>
      </div>
    </div>
  )
}
