import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { playlistApi } from '../api/client'
import type { Playlist } from '../api/types'
import { logout } from '../auth'

export default function Home() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const load = () => {
    setLoading(true)
    playlistApi
      .list()
      .then(setPlaylists)
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Digital Signage</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/media"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Media Library
          </Link>
          <Link
            to="/screens"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Screens
          </Link>
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
          <h2 className="text-xl font-semibold text-gray-800">Playlists</h2>
          <button
            onClick={() => setCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Playlist
          </button>
        </div>

        {creating && (
          <form
            onSubmit={handleCreate}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex gap-3"
          >
            <input
              autoFocus
              type="text"
              placeholder="Playlist title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-gray-500 px-3 py-2 rounded-md text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
          </form>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading…</div>
        ) : playlists.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No playlists yet. Create one to get started.
          </div>
        ) : (
          <ul className="space-y-3">
            {playlists.map((p) => (
              <li
                key={p.id}
                className="bg-white border border-gray-200 rounded-lg px-5 py-4 flex items-center justify-between hover:shadow-sm transition-shadow"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{p.title}</h3>
                  {p.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/playlists/${p.id}/edit`}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </Link>
                  <Link
                    to={`/playlists/${p.id}/play`}
                    className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 font-medium"
                  >
                    Play
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
