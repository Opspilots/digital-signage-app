import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playlistApi, mediaApi, screenApi } from '../api/client'
import type { Playlist } from '../api/types'

export default function Home() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [mediaCount, setMediaCount] = useState<number | null>(null)
  const [screenCount, setScreenCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([playlistApi.list(), mediaApi.list(), screenApi.list()])
      .then(([p, m, s]) => {
        setPlaylists(p)
        setMediaCount(m.length)
        setScreenCount(s.length)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const p = await playlistApi.create({ title: newTitle.trim() })
      setPlaylists((prev) => [p, ...prev])
      setNewTitle('')
      setCreating(false)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this playlist?')) return
    try {
      await playlistApi.delete(id)
      setPlaylists((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page top bar */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + New Playlist
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Playlists</p>
          <p className="text-3xl font-bold text-gray-100 mt-1">{playlists.length}</p>
        </div>
        <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Media</p>
          <p className="text-3xl font-bold text-gray-100 mt-1">{mediaCount ?? '—'}</p>
        </div>
        <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Screens</p>
          <p className="text-3xl font-bold text-gray-100 mt-1">{screenCount ?? '—'}</p>
        </div>
        <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Schedules</p>
          <p className="text-3xl font-bold text-gray-100 mt-1">—</p>
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-4 mb-4 flex gap-3"
        >
          <input
            autoFocus
            type="text"
            placeholder="Playlist title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="text-gray-400 hover:text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Playlist list */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : playlists.length === 0 ? (
        <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl px-5 py-12 text-center text-gray-400">
          No playlists yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map((p) => (
            <div
              key={p.id}
              className="bg-gray-800 ring-1 ring-gray-700 hover:ring-gray-600 rounded-xl px-5 py-4 flex items-center justify-between transition-all group"
            >
              <div>
                <h3 className="text-base font-semibold text-gray-100">{p.title}</h3>
                {p.description && (
                  <p className="text-sm text-gray-400 mt-0.5">{p.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to={`/playlists/${p.id}/edit`}
                  className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
                >
                  Edit
                </Link>
                <Link
                  to={`/playlists/${p.id}/play`}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Play
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-sm text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
