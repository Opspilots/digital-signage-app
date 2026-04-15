import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { screenApi, playlistApi } from '../api/client'
import type { Screen, Playlist } from '../api/types'
import { logout } from '../auth'

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
          <button
            onClick={() => setCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Register Screen
          </button>
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
    </div>
  )
}
