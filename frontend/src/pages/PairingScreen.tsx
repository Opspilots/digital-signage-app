import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { screenApi } from '../api/client'

const POLL_MS = 3000
const TICK_MS = 1000

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PairingScreen() {
  const navigate = useNavigate()
  const [code, setCode]         = useState<string | null>(null)
  const [token, setToken]       = useState<string | null>(null)
  const [expiresAt, setExpAt]   = useState<string | null>(null)
  const [now, setNow]           = useState<number>(() => Date.now())
  const [error, setError]       = useState<string | null>(null)
  const [claimed, setClaimed]   = useState(false)
  const [screenName, setScreenName] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)

  const requestCode = useCallback(() => {
    setError(null)
    setClaimed(false)
    setScreenName(null)
    screenApi.pairNew()
      .then((r) => {
        setCode(r.code)
        setToken(r.token)
        setExpAt(r.expires_at)
        try { localStorage.setItem('signage:screen_token', r.token) } catch {}
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    requestCode()
  }, [requestCode])

  // countdown tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(t)
  }, [])

  // polling for claim
  useEffect(() => {
    if (!token || claimed) return
    const poll = async () => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        const s = await screenApi.pairStatus(token)
        if (s.claimed) {
          setClaimed(true)
          setScreenName(s.name)
        }
      } catch {
        /* ignore transient errors */
      } finally {
        inFlightRef.current = false
      }
    }
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [token, claimed])

  // auto-refresh code when it expires
  useEffect(() => {
    if (!expiresAt || claimed) return
    const ms = new Date(expiresAt).getTime() - now
    if (ms <= 0) requestCode()
  }, [expiresAt, now, claimed, requestCode])

  // once claimed, heartbeat and redirect when a playlist is assigned
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
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <button onClick={requestCode} className="ds-btn">Reintentar</button>
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

  const pairUrl = typeof window !== 'undefined' ? `${window.location.origin}/pair` : '/pair'
  const remaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
      style={{ background: 'radial-gradient(circle at 30% 20%, #0d1219 0%, #07090f 60%)' }}
    >
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-6 sm:gap-8 max-w-2xl w-full">
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
              fontSize: 'clamp(48px, 14vw, 120px)',
              letterSpacing: '0.1em',
              color: 'var(--cyan)',
              textShadow: '0 0 40px rgba(34,211,238,0.4)',
              lineHeight: 1,
            }}
          >
            {code ? code.match(/.{1,3}/g)?.join('  ') : '– – – – – –'}
          </div>
          {expiresAt && (
            <p className="mt-3 text-xs font-mono" style={{ color: remaining < 60_000 ? 'var(--amber)' : 'var(--text2)' }}>
              Caduca en {formatCountdown(remaining)}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-center max-w-lg w-full">
          <div className="ds-card px-5 py-4 text-left">
            <p className="text-sm mb-2" style={{ color: 'var(--text1)' }}>Para vincular esta pantalla:</p>
            <ol className="space-y-1.5 text-sm" style={{ color: 'var(--text2)' }}>
              <li>1. Abre el panel en otro dispositivo.</li>
              <li>2. En <strong style={{ color: 'var(--text1)' }}>Pantallas</strong>, pulsa <strong style={{ color: 'var(--text1)' }}>Enlazar por código</strong>.</li>
              <li>3. Introduce el código y dale un nombre.</li>
            </ol>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div style={{ padding: 10, background: '#fff', borderRadius: 10 }}>
              <QRCodeSVG value={pairUrl} size={110} level="M" />
            </div>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>o escanea</p>
          </div>
        </div>

        <button
          onClick={requestCode}
          className="text-xs px-4 py-2 rounded-lg font-500 transition-colors"
          style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
        >
          Nuevo código
        </button>
      </div>
    </div>
  )
}
