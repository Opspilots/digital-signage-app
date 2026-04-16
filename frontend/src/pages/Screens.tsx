import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { screenApi, playlistApi } from '../api/client'
import type { Screen, Playlist } from '../api/types'
import { useBluetooth, type DiscoveredDevice } from '../hooks/useBluetooth'

interface Toast { id: number; kind: 'warn' | 'info'; message: string }

function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'Nunca'
  const diff    = Date.now() - new Date(lastSeenAt).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60)  return `hace ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `hace ${minutes}m`
  return `hace ${Math.floor(minutes / 60)}h`
}

export default function Screens() {
  const [screens,    setScreens]    = useState<Screen[]>([])
  const [playlists,  setPlaylists]  = useState<Playlist[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [creating,   setCreating]   = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newLocation,setNewLocation]= useState('')
  const [copiedId,   setCopiedId]   = useState<string | null>(null)
  const [qrScreen,   setQrScreen]   = useState<Screen | null>(null)
  const [toasts,     setToasts]     = useState<Toast[]>([])
  const [showPair,   setShowPair]   = useState(false)
  const [pairCode,   setPairCode]   = useState('')
  const [pairName,   setPairName]   = useState('')
  const [pairLoc,    setPairLoc]    = useState('')
  const [pairing,    setPairing]    = useState(false)
  const prevOnline = useRef<Map<string, boolean>>(new Map())
  const firstLoad  = useRef(true)

  const pushToast = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000)
  }

  const { isSupported: btSupported, isScanning, devices: btDevices, error: btError, scanForDevices, clearDevices, refreshPaired } = useBluetooth()
  const [showBtModal,       setShowBtModal]       = useState(false)
  const [registeringDevice, setRegisteringDevice] = useState<string | null>(null)
  const [registeredDevices, setRegisteredDevices] = useState<Set<string>>(new Set())

  const load = () => {
    Promise.all([screenApi.list(), playlistApi.list()])
      .then(([s, p]) => {
        if (!firstLoad.current) {
          s.forEach((screen) => {
            const wasOnline = prevOnline.current.get(screen.id)
            if (wasOnline === true && !screen.online) {
              pushToast({ kind: 'warn', message: `"${screen.name}" se ha desconectado` })
            }
          })
        }
        prevOnline.current = new Map(s.map((sc) => [sc.id, !!sc.online]))
        firstLoad.current = false
        setScreens(s)
        setPlaylists(p)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const s = await screenApi.create({ name: newName.trim(), location: newLocation.trim() || undefined })
      setScreens((prev) => [s, ...prev])
      setNewName(''); setNewLocation(''); setCreating(false)
    } catch (e) { setError(String(e)) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta pantalla?')) return
    try {
      await screenApi.delete(id)
      setScreens((prev) => prev.filter((s) => s.id !== id))
    } catch (e) { setError(String(e)) }
  }

  const handleAssignPlaylist = async (screenId: string, playlistId: string | null) => {
    try {
      const updated = await screenApi.update(screenId, { current_playlist_id: playlistId })
      setScreens((prev) => prev.map((s) => (s.id === screenId ? updated : s)))
    } catch (e) { setError(String(e)) }
  }

  const getPlayerUrl = (screen: Screen) =>
    screen.current_playlist_id
      ? `${window.location.origin}/playlists/${screen.current_playlist_id}/play?screen=${screen.token}`
      : null

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleOpenBt = () => {
    clearDevices()
    setRegisteredDevices(new Set())
    setShowBtModal(true)
    // Cargar dispositivos previamente emparejados al abrir
    refreshPaired()
  }
  const handleCloseBt = () => { setShowBtModal(false); clearDevices() }

  const handlePairClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pairCode.trim() || !pairName.trim()) return
    setPairing(true)
    try {
      const s = await screenApi.pairClaim({ code: pairCode.trim().toUpperCase(), name: pairName.trim(), location: pairLoc.trim() || undefined })
      setScreens((prev) => [s, ...prev])
      setShowPair(false); setPairCode(''); setPairName(''); setPairLoc('')
      pushToast({ kind: 'info', message: `"${s.name}" enlazada correctamente` })
    } catch (e) { setError(String(e)) }
    finally { setPairing(false) }
  }

  const handleRegisterDevice = async (device: DiscoveredDevice) => {
    setRegisteringDevice(device.id)
    try {
      const s = await screenApi.create({ name: device.name })
      setScreens((prev) => [s, ...prev])
      setRegisteredDevices((prev) => new Set([...prev, device.id]))
    } catch (e) { setError(String(e)) }
    finally { setRegisteringDevice(null) }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
        {toasts.map((t) => (
          <div key={t.id} className="animate-slide-up rounded-lg px-4 py-3 text-sm shadow-lg"
            style={t.kind === 'warn'
              ? { background: 'var(--amber-muted)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--amber)' }
              : { background: 'var(--cyan-muted)', border: '1px solid var(--cyan-dim)', color: 'var(--cyan)' }
            }
          >
            {t.kind === 'warn' ? '⚠ ' : '· '}{t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
        <div>
          <h1 className="font-display font-700 text-2xl" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>Pantallas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            {screens.filter(s => s.online).length} de {screens.length} en línea
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowPair(true)}
            className="flex items-center gap-2 text-sm px-3 sm:px-4 py-2 rounded-lg font-500 transition-colors"
            style={{ color: 'var(--cyan)', background: 'var(--cyan-muted)', border: '1px solid var(--cyan-dim)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Enlazar por código
          </button>
          {btSupported && (
            <button
              onClick={handleOpenBt}
              className="flex items-center gap-2 text-sm px-3 sm:px-4 py-2 rounded-lg font-500 transition-colors"
              style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.71 7.71 12 2h-1v7.59L6.41 5 5 6.41l5.59 5.59L5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
              </svg>
              Bluetooth
            </button>
          )}
          <button onClick={() => setCreating(true)} className="ds-btn">+ Registrar pantalla</button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="ds-card p-4 mb-4 animate-slide-up">
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input autoFocus type="text" placeholder="Nombre de la pantalla (p. ej. TV Recepción)" value={newName}
              onChange={(e) => setNewName(e.target.value)} className="ds-input" />
            <input type="text" placeholder="Ubicación (opcional)" value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)} className="ds-input" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="ds-btn">Registrar</button>
            <button type="button" onClick={() => { setCreating(false); setNewName(''); setNewLocation('') }}
              className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Cancelar</button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.15)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* How to connect guide */}
      {!loading && screens.length === 0 && (
        <div className="ds-card p-6 mb-4 animate-fade-in">
          <p className="font-display font-600 mb-3" style={{ color: 'var(--text1)' }}>Cómo conectar una pantalla</p>
          <ol className="space-y-2 text-sm" style={{ color: 'var(--text2)' }}>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>1</span> Pulsa <strong style={{ color: 'var(--text1)' }}>Registrar pantalla</strong> y dale un nombre.</li>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>2</span> Asigna una lista de reproducción a la pantalla.</li>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>3</span> Copia la URL del reproductor y ábrela en el dispositivo (TV, tablet, Raspberry Pi…).</li>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>4</span> La pantalla pasa a <strong style={{ color: 'var(--green)' }}>En línea</strong> y empieza a reproducir.</li>
          </ol>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text2)' }}>Cargando…</div>
      ) : (
        <ul className="space-y-3 animate-fade-in">
          {screens.map((screen) => {
            const playerUrl = getPlayerUrl(screen)
            return (
              <li key={screen.id} className="ds-card p-5 transition-colors"
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${screen.online ? 'pulse-online' : ''}`}
                        style={{ background: screen.online ? 'var(--green)' : 'var(--border2)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-600 truncate" style={{ color: 'var(--text1)' }}>{screen.name}</h3>
                        {screen.location && <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>· {screen.location}</span>}
                        <span className="text-xs font-500" style={{ color: screen.online ? 'var(--green)' : 'var(--text3)' }}>
                          {screen.online ? 'En línea' : 'Desconectada'}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                        Última vez: {formatLastSeen(screen.last_seen_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Link to={`/screens/${screen.id}/schedules`}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-500 transition-colors"
                      style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--cyan)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--cyan-dim)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)' }}
                    >
                      Horarios
                    </Link>
                    <button onClick={() => handleDelete(screen.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text2)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                    >Eliminar</button>
                  </div>
                </div>

                {/* Bottom row — playlist + actions */}
                <div className="flex items-center gap-3 flex-wrap pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <select
                    value={screen.current_playlist_id ?? ''}
                    onChange={(e) => handleAssignPlaylist(screen.id, e.target.value || null)}
                    className="text-xs rounded-lg px-2.5 py-1.5 font-500"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', outline: 'none' }}
                  >
                    <option value="">Sin lista asignada</option>
                    {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>

                  {playerUrl ? (
                    <>
                      <a href={playerUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg font-500 transition-colors"
                        style={{ color: 'var(--green)', background: 'var(--green-muted)', border: '1px solid rgba(52,211,153,0.2)' }}
                      >
                        ▶ Abrir
                      </a>
                      <button onClick={() => handleCopy(playerUrl, `url-${screen.id}`)}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                      >
                        {copiedId === `url-${screen.id}` ? '✓ Copiada' : 'Copiar URL'}
                      </button>
                      <button onClick={() => setQrScreen(screen)}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                        title="Mostrar código QR"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/>
                          <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                          <path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                        </svg>
                        QR
                      </button>
                    </>
                  ) : (
                    <span className="text-xs italic" style={{ color: 'var(--text3)' }}>Asigna una lista para poder abrir</span>
                  )}

                  <button onClick={() => handleCopy(screen.token, `tok-${screen.id}`)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-mono ml-auto"
                    style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                    title="Copiar token de pantalla"
                  >
                    {copiedId === `tok-${screen.id}` ? '✓ Token copiado' : 'Copiar token'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Bluetooth Modal */}
      {showBtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="ds-card w-full max-w-md mx-4 flex flex-col animate-slide-up" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-display font-600" style={{ color: 'var(--text1)' }}>Buscar por Bluetooth</h3>
              <button onClick={handleCloseBt} style={{ color: 'var(--text2)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="rounded-lg p-3 mb-4 text-xs leading-relaxed" style={{ background: 'var(--cyan-muted)', border: '1px solid var(--cyan-dim)', color: 'var(--text2)' }}>
                <p className="font-500 mb-1" style={{ color: 'var(--cyan)' }}>Cómo funciona</p>
                <p>Pulsa <strong style={{ color: 'var(--text1)' }}>Buscar dispositivos</strong>: el navegador abrirá una ventana con todos los dispositivos Bluetooth cercanos. Elige tu pantalla y la registraremos automáticamente.</p>
                <p className="mt-2">Requiere Chrome o Edge sobre HTTPS, la pantalla encendida y con Bluetooth activado. Puedes repetir la búsqueda para añadir más pantallas.</p>
              </div>

              {btError && (
                <div className="rounded-lg px-3 py-2 text-sm mb-4" style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>{btError}</div>
              )}

              {btDevices.length === 0 && !isScanning && !btError && (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text2)' }}>No hay dispositivos todavía. Pulsa Buscar para empezar.</p>
              )}

              {btDevices.length > 0 && (
                <ul className="space-y-2">
                  {btDevices.map((device) => {
                    const alreadyReg = registeredDevices.has(device.id)
                    const isReg      = registeringDevice === device.id
                    return (
                      <li key={device.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-500 truncate" style={{ color: 'var(--text1)' }}>{device.name}</p>
                            {device.paired && (
                              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--green-muted)', color: 'var(--green)' }}>Emparejado</span>
                            )}
                          </div>
                          <p className="text-xs font-mono truncate" style={{ color: 'var(--text2)' }}>{device.id}</p>
                        </div>
                        <button
                          onClick={() => handleRegisterDevice(device)}
                          disabled={alreadyReg || isReg}
                          className="ml-3 flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-500 transition-colors disabled:opacity-50"
                          style={alreadyReg
                            ? { background: 'var(--green-muted)', color: 'var(--green)' }
                            : { background: 'var(--cyan-muted)', color: 'var(--cyan)' }
                          }
                        >
                          {alreadyReg ? 'Registrada ✓' : isReg ? 'Registrando…' : 'Registrar'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handleCloseBt} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Cerrar</button>
              <button onClick={scanForDevices} disabled={isScanning} className="ds-btn">
                {isScanning ? 'Buscando…' : btDevices.length > 0 ? 'Buscar otro' : 'Buscar dispositivos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pair Modal */}
      {showPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => !pairing && setShowPair(false)}>
          <div className="ds-card w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-display font-600" style={{ color: 'var(--text1)' }}>Enlazar pantalla</h3>
              <button onClick={() => setShowPair(false)} style={{ color: 'var(--text2)' }} aria-label="Cerrar"
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handlePairClaim} className="p-5 space-y-4">
              <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'var(--cyan-muted)', border: '1px solid var(--cyan-dim)', color: 'var(--text2)' }}>
                Abre <span className="font-mono" style={{ color: 'var(--text1)' }}>{typeof window !== 'undefined' ? `${window.location.origin}/pair` : '/pair'}</span> en la pantalla e introduce aquí el código que aparece.
              </div>
              <div>
                <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Código</label>
                <input autoFocus type="text" value={pairCode} onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                  maxLength={8} required placeholder="XXX-XXX"
                  className="ds-input font-mono text-center" style={{ fontSize: 18, letterSpacing: '0.15em' }} />
              </div>
              <div>
                <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Nombre</label>
                <input type="text" value={pairName} onChange={(e) => setPairName(e.target.value)} required placeholder="p. ej. TV Recepción" className="ds-input" />
              </div>
              <div>
                <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Ubicación (opcional)</label>
                <input type="text" value={pairLoc} onChange={(e) => setPairLoc(e.target.value)} className="ds-input" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pairing} className="ds-btn flex-1">
                  {pairing ? 'Enlazando…' : 'Enlazar'}
                </button>
                <button type="button" onClick={() => setShowPair(false)} disabled={pairing} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrScreen && (() => {
        const url = getPlayerUrl(qrScreen)
        if (!url) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setQrScreen(null)}>
            <div className="ds-card w-full max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-display font-600" style={{ color: 'var(--text1)' }}>QR del reproductor</h3>
                <button onClick={() => setQrScreen(null)} style={{ color: 'var(--text2)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                  aria-label="Cerrar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="p-6 flex flex-col items-center gap-4">
                <p className="text-sm text-center" style={{ color: 'var(--text2)' }}>
                  Escanea con el móvil o la pantalla para abrir <span style={{ color: 'var(--text1)' }}>{qrScreen.name}</span>.
                </p>
                <div style={{ padding: 16, background: '#fff', borderRadius: 12 }}>
                  <QRCodeSVG value={url} size={220} level="M" />
                </div>
                <div className="w-full">
                  <p className="text-xs font-500 uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>URL</p>
                  <p className="text-xs font-mono break-all" style={{ color: 'var(--text2)' }}>{url}</p>
                </div>
                <button onClick={() => handleCopy(url, `qr-${qrScreen.id}`)} className="ds-btn w-full">
                  {copiedId === `qr-${qrScreen.id}` ? '✓ Copiada' : 'Copiar URL'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
