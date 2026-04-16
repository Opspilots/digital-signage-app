import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { screenApi, playlistApi } from '../api/client'
import type { Screen, Playlist } from '../api/types'
import { useBluetooth, type DiscoveredDevice } from '../hooks/useBluetooth'

function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'Never'
  const diff    = Date.now() - new Date(lastSeenAt).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60)  return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
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

  const { isSupported: btSupported, isScanning, devices: btDevices, error: btError, scanForDevices, clearDevices } = useBluetooth()
  const [showBtModal,       setShowBtModal]       = useState(false)
  const [registeringDevice, setRegisteringDevice] = useState<string | null>(null)
  const [registeredDevices, setRegisteredDevices] = useState<Set<string>>(new Set())

  const load = () => {
    Promise.all([screenApi.list(), playlistApi.list()])
      .then(([s, p]) => { setScreens(s); setPlaylists(p) })
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
    if (!confirm('Delete this screen?')) return
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

  const handleOpenBt = () => { clearDevices(); setRegisteredDevices(new Set()); setShowBtModal(true) }
  const handleCloseBt = () => { setShowBtModal(false); clearDevices() }

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
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-700 text-2xl" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>Screens</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            {screens.filter(s => s.online).length} of {screens.length} online
          </p>
        </div>
        <div className="flex gap-2">
          {btSupported && (
            <button
              onClick={handleOpenBt}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-500 transition-colors"
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
          <button onClick={() => setCreating(true)} className="ds-btn">+ Register Screen</button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="ds-card p-4 mb-4 animate-slide-up">
          <div className="flex gap-3 mb-3">
            <input autoFocus type="text" placeholder="Screen name (e.g. Lobby TV)" value={newName}
              onChange={(e) => setNewName(e.target.value)} className="ds-input" />
            <input type="text" placeholder="Location (optional)" value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)} className="ds-input" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="ds-btn">Register</button>
            <button type="button" onClick={() => { setCreating(false); setNewName(''); setNewLocation('') }}
              className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Cancel</button>
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
          <p className="font-display font-600 mb-3" style={{ color: 'var(--text1)' }}>How to connect a screen</p>
          <ol className="space-y-2 text-sm" style={{ color: 'var(--text2)' }}>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>1</span> Click <strong style={{ color: 'var(--text1)' }}>Register Screen</strong> and give it a name.</li>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>2</span> Assign a playlist to the screen.</li>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>3</span> Copy the player URL and open it on the screen device (TV, tablet, Raspberry Pi…).</li>
            <li className="flex gap-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>4</span> The screen goes <strong style={{ color: 'var(--green)' }}>Online</strong> automatically and starts playing.</li>
          </ol>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text2)' }}>Loading…</div>
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
                          {screen.online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                        Last seen: {formatLastSeen(screen.last_seen_at)}
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
                      Schedules
                    </Link>
                    <button onClick={() => handleDelete(screen.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text2)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                    >Delete</button>
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
                    <option value="">No playlist assigned</option>
                    {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>

                  {playerUrl ? (
                    <>
                      <a href={playerUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg font-500 transition-colors"
                        style={{ color: 'var(--green)', background: 'var(--green-muted)', border: '1px solid rgba(52,211,153,0.2)' }}
                      >
                        ▶ Launch
                      </a>
                      <button onClick={() => handleCopy(playerUrl, `url-${screen.id}`)}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                      >
                        {copiedId === `url-${screen.id}` ? '✓ Copied' : 'Copy URL'}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs italic" style={{ color: 'var(--text3)' }}>Assign a playlist to launch</span>
                  )}

                  <button onClick={() => handleCopy(screen.token, `tok-${screen.id}`)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-mono ml-auto"
                    style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                    title="Copy screen token"
                  >
                    {copiedId === `tok-${screen.id}` ? '✓ Token copied' : 'Copy token'}
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
              <h3 className="font-display font-600" style={{ color: 'var(--text1)' }}>Bluetooth Discovery</h3>
              <button onClick={handleCloseBt} style={{ color: 'var(--text2)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--amber-muted)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--amber)' }}>
                ⚡ Requires Chrome or Edge + HTTPS. The screen device must be BLE-advertising. For most TVs and monitors, use <strong>Register Screen</strong> manually instead.
              </div>

              {btError && (
                <div className="rounded-lg px-3 py-2 text-sm mb-4" style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>{btError}</div>
              )}

              {btDevices.length === 0 && !isScanning && !btError && (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text2)' }}>No devices found. Click Scan to start.</p>
              )}

              {btDevices.length > 0 && (
                <ul className="space-y-2">
                  {btDevices.map((device) => {
                    const alreadyReg = registeredDevices.has(device.id)
                    const isReg      = registeringDevice === device.id
                    return (
                      <li key={device.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-500 truncate" style={{ color: 'var(--text1)' }}>{device.name}</p>
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
                          {alreadyReg ? 'Registered ✓' : isReg ? 'Registering…' : 'Register'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handleCloseBt} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Close</button>
              <button onClick={scanForDevices} disabled={isScanning} className="ds-btn">
                {isScanning ? 'Scanning…' : 'Scan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
