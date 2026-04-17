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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { playlistApi, itemApi, BASE_URL } from '../api/client'
import type { Playlist, PlaylistItem } from '../api/types'
import MediaLibrary from './MediaLibrary'
import type { MediaFile } from '../api/types'
import { useToast } from '../toast'
import { DAYS, DAY_BITS, isDayActive } from '../utils/schedule'

// Etiquetas cortas para el editor de ítems
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

function SortableItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: PlaylistItem
  onUpdate: (id: string, field: string, value: unknown) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const inputStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 8px',
    color: 'var(--text1)',
    fontSize: 12,
    outline: 'none',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  const [schedOpen, setSchedOpen] = useState(false)
  const mask = item.days_of_week ?? 0
  const hasSchedule = mask !== 0 || !!item.start_time || !!item.end_time

  const toggleDay = (bit: number) => {
    const next = mask ^ bit
    onUpdate(item.id, 'days_of_week', next)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, transition: 'border-color 0.15s', flexWrap: 'wrap' }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)')}
    >
      <button {...attributes} {...listeners}
        style={{ color: 'var(--text3)', cursor: 'grab', flexShrink: 0, marginTop: 2, fontSize: 18, lineHeight: 1 }}
        title="Arrastra para reordenar"
      >⠿</button>

      <div style={{ width: 80, height: 52, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--surface2)' }}>
        {item.media_file && (
          <img src={`${BASE_URL}${item.media_file.thumbnail_url ?? item.media_file.url}`}
            alt={item.media_file.original_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 8 }}>
          {item.media_file?.original_name ?? item.media_file_id}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
            Duración (s)
            <input type="number" min={1} value={item.display_duration}
              onChange={(e) => onUpdate(item.id, 'display_duration', Number(e.target.value))}
              style={{ ...inputStyle, width: 56 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
            Transición
            <select value={item.transition_type} onChange={(e) => onUpdate(item.id, 'transition_type', e.target.value)} style={selectStyle}>
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
            Duración (ms)
            <input type="number" min={0} step={100} value={item.transition_duration}
              onChange={(e) => onUpdate(item.id, 'transition_duration', Number(e.target.value))}
              style={{ ...inputStyle, width: 68 }} />
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
        </div>

        {schedOpen && (
          <div className="mt-3 p-3 rounded-lg animate-slide-up" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
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
                <button type="button" onClick={() => onUpdate(item.id, 'days_of_week', 0)}
                  className="text-xs ml-1" style={{ color: 'var(--text3)' }}
                >Limpiar</button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
                Desde
                <input type="time" value={item.start_time ?? ''}
                  onChange={(e) => onUpdate(item.id, 'start_time', e.target.value || null)}
                  style={{ ...inputStyle, width: 92 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
                Hasta
                <input type="time" value={item.end_time ?? ''}
                  onChange={(e) => onUpdate(item.id, 'end_time', e.target.value || null)}
                  style={{ ...inputStyle, width: 92 }} />
              </label>
              {(item.start_time || item.end_time) && (
                <button type="button"
                  onClick={() => { onUpdate(item.id, 'start_time', null); onUpdate(item.id, 'end_time', null) }}
                  className="text-xs" style={{ color: 'var(--text3)' }}
                >Sin restricción</button>
              )}
            </div>
          </div>
        )}
      </div>

      <button onClick={() => onRemove(item.id)} title="Quitar" style={{ color: 'var(--text3)', fontSize: 18, flexShrink: 0, marginTop: 2, lineHeight: 1, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
      >✕</button>
    </div>
  )
}

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
        setItems(p.items ?? [])
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  // Warn user if they try to navigate away with unsaved title/description changes
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
    setItems((prevItems) => prevItems.filter((i) => i.id !== itemId))
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
      setItems((prev) => [...prev, { ...newItem, media_file: file }])
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
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
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
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
        <input type="text" value={titleDraft}
          onChange={(e) => { setTitleDraft(e.target.value); setDirty(true) }}
          className="w-full font-display font-600 text-xl bg-transparent focus:outline-none pb-2 mb-3"
          style={{ color: 'var(--text1)', borderBottom: '1px solid var(--border)', letterSpacing: '-0.01em' }}
          placeholder="Título de la lista" />
        <textarea value={descDraft} onChange={(e) => { setDescDraft(e.target.value); setDirty(true) }}
          className="w-full text-sm bg-transparent focus:outline-none resize-none"
          style={{ color: 'var(--text2)' }} placeholder="Descripción (opcional)" rows={2} />
      </div>

      {/* Items header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>
            Elementos
          </p>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
            {items.length}
          </span>
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>
        <button onClick={() => setShowMedia(!showMedia)} className="ds-btn ml-4">+ Añadir contenido</button>
      </div>

      {/* Media picker */}
      {showMedia && (
        <div className="ds-card mb-6 overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-500" style={{ color: 'var(--text1)' }}>Selecciona un archivo</span>
            <button onClick={() => setShowMedia(false)} style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto', background: 'var(--surface2)' }}>
            <MediaLibrary selectionMode selectedIds={new Set(items.map((i) => i.media_file_id))} onSelect={handleMediaSelect} />
          </div>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="ds-card px-5 py-12 text-center animate-fade-in">
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Aún no hay elementos. Pulsa "+ Añadir contenido" para empezar.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 animate-fade-in">
              {items.map((item) => (
                <SortableItem key={item.id} item={item} onUpdate={handleItemUpdate} onRemove={handleItemRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
