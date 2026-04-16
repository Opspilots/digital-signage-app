import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { screenApi, playlistApi } from '../api/client'
import type { Screen, Playlist } from '../api/types'
import { logout } from '../auth'
import { useBluetooth, type DiscoveredDevice } from '../hooks/useBluetooth'

function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'Never'
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export default function Screens() {
  const navigate = useNavigate()
  const [screens, setScreens] = useState<Screen[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Bluetooth discovery state
  const { isSupported: btSupported, isScanning, devices: btDevices, error: btError, scanForDevices, clearDevices } = useBluetooth()
  const [showBtModal, setShowBtModal] = useState(false)
  const [registeringDevice, setRegisteringDevice] = useState<string | null>(null)
  const [registeredDevices, setRegisteredDevices] = useState<Set<string>>(new Set())
  const [showBtTooltip, setShowBtTooltip] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([screenApi.list(), playlistApi.list()])
      .then(([s, p]) => {
        setScreens(s)
        setPlaylists(p)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const s = await screenApi.create({ name: newName.trim(), location: newLocation.trim() || undefined })
      setScreens((prev) => [s, ...prev])
      setNewName('')
      setNewLocation('')
      setCreating(false)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this screen?')) return
    try {
      await screenApi.delete(id)
      setScreens((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      setError(String(e))
    }
  }

  const handleAssignPlaylist = async (screenId: string, playlistId: string | null) => {
    try {
      const updated = await screenApi.update(screenId, { current_playlist_id: playlistId })
      setScreens((prev) => prev.map((s) => (s.id === screenId ? updated : s)))
    } catch (e) {
      setError(String(e))
    }
  }

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }

  const handleOpenBtModal = () => {
    clearDevices()
    setRegisteredDevices(new Set())
    setShowBtModal(true)
  }

  const handleCloseBtModal = () => {
    setShowBtModal(false)
    clearDevices()
  }

  const handleRegisterDevice = async (device: DiscoveredDevice) => {
    setRegisteringDevice(device.id)
    try {
      const s = await screenApi.create({ name: device.name })
      setScreens((prev) => [s, ...prev])
      setRegisteredDevices((prev) => new Set([...prev, device.id]))
    } catch (e) {
      setError(String(e))
    } finally {
      setRegisteringDevice(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Digital Signage</h1>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Playlists</Link>
          <Link to="/media" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Media Library</Link>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Screens</h2>
          <div className="flex items-center gap-2">
            {btSupported && (
              <div className="relative flex items-center">
                <button
                  onClick={handleOpenBtModal}
                  className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
                >
                  <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.71 7.71 12 2h-1v7.59L6.41 5 5 6.41l5.59 5.59L5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
                  </svg>
                  Discover via Bluetooth
                </button>
                <button
                  onMouseEnter={() => setShowBtTooltip(true)}
                  onMouseLeave={() => setShowBtTooltip(false)}
                  onFocus={() => setShowBtTooltip(true)}
                  onBlur={() => setShowBtTooltip(false)}
                  aria-label="Bluetooth information"
                  className="ml-1 w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  i
                </button>
                {showBtTooltip && (
                  <div className="absolute right-0 top-8 z-10 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                    Bluetooth scanning requires a secure context (HTTPS or localhost). It will not work on plain HTTP pages.
                    <div className="absolute -top-1.5 right-6 w-3 h-3 bg-gray-900 rotate-45" />
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setCreating(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Register Screen
            </button>
          </div>
        </div>

        {creating && (
          <form
            onSubmit={handleCreate}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-col gap-3"
          >
            <div className="flex gap-3">
              <input
                autoFocus
                type="text"
                placeholder="Screen name (e.g. Lobby TV)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Location (optional)"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setNewName(''); setNewLocation('') }}
                className="text-gray-500 px-3 py-2 rounded-md text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading…</div>
        ) : screens.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No screens registered yet. Register one to get started.
          </div>
        ) : (
          <ul className="space-y-3">
            {screens.map((screen) => (
              <li
                key={screen.id}
                className="bg-white border border-gray-200 rounded-lg px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                          screen.online ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                      <h3 className="font-medium text-gray-900 truncate">{screen.name}</h3>
                      {screen.location && (
                        <span className="text-xs text-gray-400 truncate">· {screen.location}</span>
                      )}
                      <span className={`text-xs font-medium ${screen.online ? 'text-green-600' : 'text-gray-400'}`}>
                        {screen.online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Last seen: {formatLastSeen(screen.last_seen_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <select
                      value={screen.current_playlist_id ?? ''}
                      onChange={(e) => handleAssignPlaylist(screen.id, e.target.value || null)}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No playlist</option>
                      {playlists.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleCopyToken(screen.token)}
                      className="text-sm text-gray-500 hover:text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs"
                      title="Copy screen token"
                    >
                      {copiedToken === screen.token ? '✓ Copied' : 'Copy token'}
                    </button>
                    <button
                      onClick={() => handleDelete(screen.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Bluetooth Discovery Modal */}
      {showBtModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bt-modal-title"
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 id="bt-modal-title" className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.71 7.71 12 2h-1v7.59L6.41 5 5 6.41l5.59 5.59L5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
                </svg>
                Bluetooth Screen Discovery
              </h3>
              <button
                onClick={handleCloseBtModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-sm text-gray-500 mb-4">
                Click <strong>Scan</strong> to open the browser Bluetooth picker. Select a nearby
                screen device to add it to your list.
              </p>

              {btError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
                  {btError}
                </div>
              )}

              {btDevices.length === 0 && !isScanning && !btError && (
                <div className="text-center text-gray-400 py-6 text-sm">
                  No devices found yet. Click Scan to start.
                </div>
              )}

              {btDevices.length > 0 && (
                <ul className="space-y-2">
                  {btDevices.map((device) => {
                    const alreadyRegistered = registeredDevices.has(device.id)
                    const isRegistering = registeringDevice === device.id
                    return (
                      <li
                        key={device.id}
                        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{device.name}</p>
                          <p className="text-xs text-gray-400 font-mono truncate">{device.id}</p>
                        </div>
                        <button
                          onClick={() => handleRegisterDevice(device)}
                          disabled={alreadyRegistered || isRegistering}
                          className={`ml-3 flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            alreadyRegistered
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : isRegistering
                              ? 'bg-blue-100 text-blue-500 cursor-wait'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {alreadyRegistered ? 'Registered' : isRegistering ? 'Registering…' : 'Register as Screen'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 gap-3">
              <p className="text-xs text-gray-400">
                Requires HTTPS or localhost
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCloseBtModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={scanForDevices}
                  disabled={isScanning}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
                >
                  {isScanning ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Scanning…
                    </>
                  ) : (
                    'Scan'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
