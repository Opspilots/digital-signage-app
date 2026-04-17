import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playlistApi, mediaApi, screenApi } from '../api/client'
import type { Playlist, Screen } from '../api/types'
import { useToast } from '../toast'
import ConfirmModal from '../components/ConfirmModal'

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="ds-card p-5 animate-fade-in">
      <p className="text-xs font-500 uppercase tracking-widest mb-3" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p className="font-display font-700" style={{ fontSize: 36, lineHeight: 1, color: accent ? 'var(--cyan)' : 'var(--text1)' }}>
        {value}
      </p>
    </div>
  )
}

export default function Home() {
  const [playlists,   setPlaylists]   = useState<Playlist[]>([])
  const [mediaCount,  setMediaCount]  = useState<number | null>(null)
  const [screens,     setScreens]     = useState<Screen[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [creating,    setCreating]    = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [search,      setSearch]      = useState('')
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [confirmId,     setConfirmId]     = useState<string | null>(null)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    Promise.all([playlistApi.list(), mediaApi.list(), screenApi.list()])
      .then(([p, m, s]) => { setPlaylists(p.items); setMediaCount(m.total); setScreens(s as Screen[]) })
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
      toast.success(`"${p.title}" creada`)
    } catch (e) { setError(String(e)) }
  }

  const handleDelete = (id: string) => {
    setConfirmId(id)
    setConfirmOpen(true)
  }

  const executeDelete = async () => {
    setConfirmOpen(false)
    if (!confirmId) return
    const id = confirmId
    setConfirmId(null)
    try {
      await playlistApi.delete(id)
      setPlaylists((prev) => prev.filter((p) => p.id !== id))
      toast.success('Lista eliminada')
    } catch (e) { setError(String(e)) }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await playlistApi.duplicate(id)
      setPlaylists((prev) => [copy, ...prev])
      toast.success(`"${copy.title}" creada`)
    } catch (e) { setError(String(e)) }
  }

  const onlineCount = screens.filter((s) => s.online).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
        <div>
          <h1 className="font-display font-700 text-2xl" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>
            Panel de control
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>Gestiona tu contenido y tus pantallas</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="ds-btn"
        >
          + Nueva lista
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ds-card p-5">
              <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-2/3 mb-4" />
              <div className="h-9 rounded bg-gray-200 dark:bg-gray-700 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Listas" value={playlists.length} />
          <StatCard label="Archivos multimedia" value={mediaCount ?? '—'} />
          <StatCard label="Pantallas" value={screens.length} />
          <StatCard label="En línea" value={onlineCount} accent={onlineCount > 0} />
        </div>
      )}

      {/* Create form */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="ds-card p-4 mb-4 flex gap-3 animate-slide-up"
        >
          <input
            autoFocus
            type="text"
            placeholder="Título de la lista…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="ds-input flex-1"
            style={{ width: 'auto' }}
          />
          <button type="submit" className="ds-btn flex-shrink-0">Crear</button>
          <button
            type="button"
            onClick={() => { setCreating(false); setNewTitle('') }}
            className="text-sm px-3 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--text2)' }}
          >
            Cancelar
          </button>
        </form>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.15)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center gap-3 mb-3">
        <p className="text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>
          Listas de reproducción
        </p>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {playlists.length > 1 && (
        <div className="mb-3 relative">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text2)' }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar listas…"
            className="ds-input"
            style={{ paddingLeft: 36 }}
          />
        </div>
      )}

      {(() => { const q = search.trim().toLowerCase(); const filtered = q
        ? playlists.filter((p) => p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
        : playlists
      ; return loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ds-card px-5 py-4 flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 w-1/3" />
              </div>
              <div className="flex gap-2 ml-4">
                <div className="h-7 w-14 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-7 w-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-7 w-14 rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="ds-card px-6 py-14 text-center animate-fade-in">
          <p className="text-3xl mb-3">🎬</p>
          <p className="font-500 mb-1" style={{ color: 'var(--text1)' }}>Aún no hay listas</p>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Crea una para empezar a programar contenido en tus pantallas.</p>
        </div>
      ) : filtered.length === 0 && q ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text2)' }}>Sin resultados para "{search}".</div>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="ds-card px-5 py-4 flex items-center justify-between group transition-colors"
              style={{ cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="min-w-0">
                <h3 className="font-500 truncate" style={{ color: 'var(--text1)' }}>{p.title}</h3>
                {p.description && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>{p.description}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <Link
                  to={`/playlists/${p.id}/edit`}
                  className="text-xs px-3 py-1.5 rounded-lg font-500 transition-colors"
                  style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)' }}
                >
                  Editar
                </Link>
                <Link
                  to={`/playlists/${p.id}/play`}
                  className="text-xs px-3 py-1.5 rounded-lg font-500 transition-colors"
                  style={{ color: 'var(--green)', background: 'var(--green-muted)', border: '1px solid rgba(52,211,153,0.2)' }}
                >
                  ▶ Reproducir
                </Link>
                <button
                  onClick={() => handleDuplicate(p.id)}
                  className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text2)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                  title="Duplicar lista"
                >
                  Duplicar
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text2)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) })()}

      <ConfirmModal
        open={confirmOpen}
        title="Eliminar lista"
        message={`¿Eliminar "${playlists.find((p) => p.id === confirmId)?.title ?? 'esta lista'}"? Esta acción no se puede deshacer.`}
        onConfirm={executeDelete}
        onCancel={() => { setConfirmOpen(false); setConfirmId(null) }}
      />
    </div>
  )
}
