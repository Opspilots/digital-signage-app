import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { playlistApi, itemApi, BASE_URL } from '../api/client'
import type { Playlist, PlaylistItem } from '../api/types'
import MediaLibrary from './MediaLibrary'
import type { MediaFile } from '../api/types'
import { useToast } from '../toast'
import { DAY_BITS, isDayActive } from '../utils/schedule'

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function scheduleSummary(item: PlaylistItem): string {
  const mask = item.days_of_week ?? 0
  const hasTime = item.start_time || item.end_time
  if (mask === 0 && !hasTime) return 'Siempre'
  const days = mask === 127 ? 'Todos los días'
    : mask === 31 ? 'L–V'
    : mask === 96 ? 'S–D'
    : mask === 0 ? 'Todos los días'
    : DAY_LABELS.filter((_, i) => isDayActive(mask, i)).join(' ')
  const time = hasTime ? `${item.start_time ?? '00:00'}–${item.end_time ?? '23:59'}` : ''
  return [days, time].filter(Boolean).join(' · ')
}

function clipGradient(mimeType: string | undefined): string {
  if (!mimeType) return 'linear-gradient(135deg, #374151, #1f2937)'
  if (mimeType.startsWith('image/')) return 'linear-gradient(135deg, #3730a3, #1e1b4b)'
  if (mimeType.startsWith('video/')) return 'linear-gradient(135deg, #065f46, #022c22)'
  if (mimeType.startsWith('audio/')) return 'linear-gradient(135deg, #78350f, #1c1005)'
  return 'linear-gradient(135deg, #374151, #1f2937)'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Timeline Clip (draggable) ────────────────────────────────────────────────

function TimelineClip({
  item,
  selected,
  onClick,
}: {
  item: PlaylistItem
  selected: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const clipWidth = Math.max(80, item.display_duration * 20)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: clipWidth,
    minWidth: clipWidth,
    height: 80,
    flexShrink: 0,
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'pointer',
    outline: selected ? '2px solid #3b82f6' : '2px solid transparent',
    boxShadow: selected ? '0 0 0 4px rgba(59,130,246,0.2)' : 'none',
    borderLeft: selected ? '3px solid #3b82f6' : '3px solid #4b5563',
    userSelect: 'none',
  }

  const hasThumbnail = !!item.media_file?.thumbnail_url
  const thumbnailSrc = item.media_file?.thumbnail_url
    ? `${BASE_URL}${item.media_file.thumbnail_url}`
    : item.media_file?.mime_type?.startsWith('image/')
      ? `${BASE_URL}${item.media_file.url}`
      : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      title={item.media_file?.original_name ?? ''}
      {...attributes}
      {...listeners}
    >
      {/* Background: thumbnail or gradient */}
      {thumbnailSrc && hasThumbnail ? (
        <img
          src={thumbnailSrc}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: clipGradient(item.media_file?.mime_type) }} />
      )}

      {/* Hover overlay */}
      <div
        className="clip-hover-overlay"
        style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0)', transition: 'background 0.15s', pointerEvents: 'none' }}
      />

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 22,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 5px', gap: 4,
      }}>
        <span style={{
          fontSize: 9, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {item.media_file?.original_name ?? '—'}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
          {item.display_duration}s
        </span>
      </div>
    </div>
  )
}

// ─── Inspector Panel ──────────────────────────────────────────────────────────

function Inspector({
  item,
  onUpdate,
  onRemove,
  onClose,
}: {
  item: PlaylistItem
  onUpdate: (id: string, field: string, value: unknown) => void
  onRemove: (id: string) => void
  onClose: () => void
}) {
  const [schedOpen, setSchedOpen] = useState(false)
  const mask = item.days_of_week ?? 0
  const hasSchedule = mask !== 0 || !!item.start_time || !!item.end_time

  const toggleDay = (bit: number) => {
    const next = mask ^ bit
    onUpdate(item.id, 'days_of_week', next)
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 8px',
    color: 'var(--text1)',
    fontSize: 12,
    outline: 'none',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  const thumbnailSrc = item.media_file?.thumbnail_url
    ? `${BASE_URL}${item.media_file.thumbnail_url}`
    : item.media_file?.mime_type?.startsWith('image/')
      ? `${BASE_URL}${item.media_file.url}`
      : undefined

  return (
    <div
      className="animate-slide-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
      }}
    >
      {/* Inspector header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)' }}>
          Inspector
        </span>
        <button
          onClick={onClose}
          style={{ color: 'var(--text3)', lineHeight: 1, fontSize: 16 }}
          title="Cerrar inspector"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Main row: thumbnail + info + controls */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        {/* Thumbnail / type icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
          background: clipGradient(item.media_file?.mime_type),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {item.media_file?.mime_type?.startsWith('audio/') ? (
                <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>
              ) : item.media_file?.mime_type?.startsWith('video/') ? (
                <><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></>
              ) : (
                <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>
              )}
            </svg>
          )}
        </div>

        {/* File name + mime */}
        <div style={{ flex: '0 0 auto', minWidth: 120, maxWidth: 200 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', wordBreak: 'break-word', marginBottom: 4 }}>
            {item.media_file?.original_name ?? item.media_file_id}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>
            {item.media_file?.mime_type ?? '—'}
          </p>
          {item.media_file?.size != null && (
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>{formatBytes(item.media_file.size)}</p>
          )}
        </div>

        {/* Controls */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              Duración (s)
              <input
                type="number"
                min={1}
                value={item.display_duration}
                onChange={(e) => onUpdate(item.id, 'display_duration', Number(e.target.value))}
                style={{ ...inputStyle, width: 56 }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              Transición
              <select
                value={item.transition_type}
                onChange={(e) => onUpdate(item.id, 'transition_type', e.target.value)}
                style={selectStyle}
              >
                <option value="none">Ninguna</option>
                <option value="fade">Desvanecer</option>
                <option value="slide">Deslizar</option>
                <option value="zoom-in">Acercar</option>
                <option value="zoom-out">Alejar</option>
                <option value="slide-left">Deslizar izquierda</option>
                <option value="slide-up">Deslizar arriba</option>
                <option value="slide-down">Deslizar abajo</option>
                <option value="blur-in">Desenfocar</option>
                <option value="flip">Voltear</option>
                <option value="rotate-in">Rotar</option>
                <option value="bounce-in">Rebote</option>
                <option value="wipe-right">Barrido</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              Duración trans. (ms)
              <input
                type="number"
                min={0}
                step={100}
                value={item.transition_duration}
                onChange={(e) => onUpdate(item.id, 'transition_duration', Number(e.target.value))}
                style={{ ...inputStyle, width: 68 }}
              />
            </label>

            <button
              type="button"
              onClick={() => setSchedOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors"
              style={hasSchedule
                ? { color: 'var(--cyan)', background: 'var(--cyan-muted)', border: '1px solid var(--cyan-dim)' }
                : { color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }
              }
              title="Mostrar solo en ciertos días/horas"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {hasSchedule ? scheduleSummary(item) : 'Horario'}
            </button>

            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: 'var(--red)', background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.2)' }}
              title="Eliminar clip"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              Eliminar
            </button>
          </div>

          {/* Schedule panel */}
          {schedOpen && (
            <div className="mt-2 p-3 rounded-lg animate-slide-up" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span style={{ fontSize: 11, color: 'var(--text2)', marginRight: 4 }}>Días:</span>
                {DAY_LABELS.map((label, i) => {
                  const bit = DAY_BITS[i]
                  const active = isDayActive(mask, i)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(bit)}
                      className="w-7 h-7 rounded-full text-xs font-600 transition-colors"
                      style={active
                        ? { background: 'var(--cyan-muted)', color: 'var(--cyan)', border: '1px solid var(--cyan-dim)' }
                        : { background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)' }
                      }
                    >{label}</button>
                  )
                })}
                {mask !== 0 && (
                  <button
                    type="button"
                    onClick={() => onUpdate(item.id, 'days_of_week', 0)}
                    className="text-xs ml-1"
                    style={{ color: 'var(--text3)' }}
                  >Limpiar</button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
                  Desde
                  <input
                    type="time"
                    value={item.start_time ?? ''}
                    onChange={(e) => onUpdate(item.id, 'start_time', e.target.value || null)}
                    style={{ ...inputStyle, width: 92 }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
                  Hasta
                  <input
                    type="time"
                    value={item.end_time ?? ''}
                    onChange={(e) => onUpdate(item.id, 'end_time', e.target.value || null)}
                    style={{ ...inputStyle, width: 92 }}
                  />
                </label>
                {(item.start_time || item.end_time) && (
                  <button
                    type="button"
                    onClick={() => { onUpdate(item.id, 'start_time', null); onUpdate(item.id, 'end_time', null) }}
                    className="text-xs"
                    style={{ color: 'var(--text3)' }}
                  >Sin restricción</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function PlaylistEditor() {
  const { id } = useParams<{ id: string }>()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showMedia, setShowMedia] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    playlistApi
      .get(id)
      .then((p) => {
        setPlaylist(p)
        setTitleDraft(p.title)
        setDescDraft(p.description ?? '')
        const loadedItems = p.items ?? []
        setItems(loadedItems)
        setSelectedItemId(loadedItems[0]?.id ?? null)
        setError(null)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    // selectedItemId stays unchanged on reorder

    try {
      await itemApi.reorder(id!, reordered.map((i) => i.id))
    } catch (e) {
      setError(String(e))
    }
  }

  const handleItemUpdate = async (itemId: string, field: string, value: unknown) => {
    const prev = items
    setItems((prevItems) =>
      prevItems.map((i) => (i.id === itemId ? { ...i, [field]: value } : i))
    )
    try {
      await itemApi.update(id!, itemId, { [field]: value } as Partial<PlaylistItem>)
    } catch (e) {
      setItems(prev)
      setError(String(e))
    }
  }

  const handleItemRemove = async (itemId: string) => {
    const prev = items
    const removedIndex = items.findIndex((i) => i.id === itemId)
    const nextItems = items.filter((i) => i.id !== itemId)
    setItems(nextItems)

    // If removed item was selected, select the previous one or null
    if (selectedItemId === itemId) {
      const newSelected = nextItems[Math.max(0, removedIndex - 1)]?.id ?? nextItems[0]?.id ?? null
      setSelectedItemId(newSelected)
    }

    try {
      await itemApi.remove(id!, itemId)
    } catch (e) {
      setItems(prev)
      setError(String(e))
    }
  }

  const handleMediaSelect = async (file: MediaFile) => {
    try {
      const newItem = await itemApi.add(id!, {
        media_file_id: file.id,
        display_duration: 5,
        transition_type: 'none',
        transition_duration: 500,
      })
      const itemWithFile = { ...newItem, media_file: file }
      setItems((prev) => [...prev, itemWithFile])
      setSelectedItemId(newItem.id)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleExport = async () => {
    if (!id) return
    setExporting(true)
    try {
      const data = await playlistApi.exportPlaylist(id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `playlist-${(playlist?.title ?? 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Lista exportada')
    } catch (e) {
      setError(String(e))
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      const result = await playlistApi.importPlaylist(data)
      if (result.warnings.length > 0) {
        toast.success(`Lista importada con ${result.warnings.length} advertencia${result.warnings.length !== 1 ? 's' : ''}`)
        setError(result.warnings.join('\n'))
      } else {
        toast.success('Lista importada correctamente')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setImporting(false)
    }
  }

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      await playlistApi.update(id, { title: titleDraft, description: descDraft })
      setDirty(false)
      toast.success('Cambios guardados')
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text2)' }}>Cargando…</div>
  if (!playlist) return <div className="p-8 text-sm" style={{ color: 'var(--red)' }}>{error ?? 'No encontrada'}</div>

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <p className="text-xs font-500 uppercase tracking-widest mb-1" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>
            Editando lista
          </p>
          <h1 className="font-display font-700 text-2xl" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>
            {titleDraft || 'Sin título'}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleSave} disabled={saving || !dirty} className="ds-btn" style={{ opacity: (!dirty || saving) ? 0.4 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="ds-btn"
            style={{ background: 'var(--surface2)', color: 'var(--text1)', border: '1px solid var(--border)' }}
            title="Exportar lista como JSON"
          >
            {exporting ? 'Exportando…' : 'Exportar'}
          </button>
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="ds-btn"
            style={{ background: 'var(--surface2)', color: 'var(--text1)', border: '1px solid var(--border)' }}
            title="Importar lista desde JSON"
          >
            {importing ? 'Importando…' : 'Importar'}
          </button>
          <Link to={`/playlists/${id}/play`} className="ds-btn"
            style={{ background: 'var(--green-muted)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)' }}>
            ▶ Reproducir
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.15)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="ds-card p-5 mb-6">
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => { setTitleDraft(e.target.value); setDirty(true) }}
          className="w-full font-display font-600 text-xl bg-transparent focus:outline-none pb-2 mb-3"
          style={{ color: 'var(--text1)', borderBottom: '1px solid var(--border)', letterSpacing: '-0.01em' }}
          placeholder="Título de la lista"
        />
        <textarea
          value={descDraft}
          onChange={(e) => { setDescDraft(e.target.value); setDirty(true) }}
          className="w-full text-sm bg-transparent focus:outline-none resize-none"
          style={{ color: 'var(--text2)' }}
          placeholder="Descripción (opcional)"
          rows={2}
        />
      </div>

      {/* Timeline section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <p className="text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>
            Timeline
          </p>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
            {items.length} clips
          </span>
        </div>
        <button onClick={() => setShowMedia(!showMedia)} className="ds-btn">+ Añadir contenido</button>
      </div>

      {/* Media picker */}
      {showMedia && (
        <div className="ds-card mb-4 overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-500" style={{ color: 'var(--text1)' }}>Selecciona un archivo</span>
            <button
              onClick={() => setShowMedia(false)}
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto', background: 'var(--surface2)' }}>
            <MediaLibrary
              selectionMode
              selectedIds={new Set(items.map((i) => i.media_file_id).filter((mid): mid is string => mid !== null))}
              onSelect={(file) => { handleMediaSelect(file); setShowMedia(false) }}
            />
          </div>
        </div>
      )}

      {/* Timeline track */}
      <div
        style={{
          background: '#111827',
          borderRadius: 12,
          border: '1px solid #1f2937',
          padding: 12,
          marginBottom: 4,
        }}
      >
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563' }}>
            Track 1
          </span>
          <span style={{ fontSize: 10, color: '#374151' }}>
            {items.reduce((acc, i) => acc + i.display_duration, 0)}s total
          </span>
        </div>

        {/* Scrollable track */}
        <div
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 4,
            // Grid lines every 100px
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 99px, rgba(75,85,99,0.15) 99px, rgba(75,85,99,0.15) 100px)',
            backgroundSize: '100px 100%',
            position: 'relative',
          }}
        >
          {/* Decorative playhead */}
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: 2,
            background: '#ef4444', zIndex: 10, pointerEvents: 'none',
          }} />

          {items.length === 0 ? (
            <div style={{
              height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#374151', fontSize: 13, fontStyle: 'italic',
            }}>
              Sin clips — pulsa "+ Añadir contenido" para empezar
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 'min-content', paddingLeft: 2 }}>
                  {items.map((item) => (
                    <TimelineClip
                      key={item.id}
                      item={item}
                      selected={selectedItemId === item.id}
                      onClick={() => setSelectedItemId(item.id)}
                    />
                  ))}
                  {/* Add button at end of track */}
                  <button
                    onClick={() => setShowMedia(true)}
                    style={{
                      width: 48, height: 80, flexShrink: 0,
                      background: 'rgba(55,65,81,0.4)',
                      border: '1px dashed #374151',
                      borderRadius: 6,
                      color: '#6b7280',
                      fontSize: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.color = '#9ca3af' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = '#6b7280' }}
                    title="Añadir clip"
                  >
                    +
                  </button>
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Inspector */}
      {selectedItem && (
        <Inspector
          item={selectedItem}
          onUpdate={handleItemUpdate}
          onRemove={handleItemRemove}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </div>
  )
}
