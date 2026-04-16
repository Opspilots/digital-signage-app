import { useEffect, useState, useCallback } from 'react'
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

  const isVideo = item.media_file?.mime_type.startsWith('video/')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-800 ring-1 ring-gray-700 hover:ring-gray-600 rounded-xl flex items-start gap-3 p-3 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0 text-lg"
        title="Drag to reorder"
      >
        ⠿
      </button>

      <div className="w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-900">
        {item.media_file && (
          <img
            src={`${BASE_URL}${item.media_file.thumbnail_url ?? item.media_file.url}`}
            alt={item.media_file.original_name}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100 truncate">
          {item.media_file?.original_name ?? item.media_file_id}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 items-center">
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Duration (s)
            <input
              type="number"
              min={1}
              value={item.display_duration}
              onChange={(e) => onUpdate(item.id, 'display_duration', Number(e.target.value))}
              className="w-16 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Transition
            <select
              value={item.transition_type}
              onChange={(e) => onUpdate(item.id, 'transition_type', e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="zoom-in">Zoom In</option>
              <option value="zoom-out">Zoom Out</option>
              <option value="slide-left">Slide from Left</option>
              <option value="slide-up">Slide Up</option>
              <option value="slide-down">Slide Down</option>
              <option value="blur-in">Blur In</option>
              <option value="flip">Flip</option>
              <option value="rotate-in">Rotate In</option>
              <option value="bounce-in">Bounce In</option>
              <option value="wipe-right">Wipe Right</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Trans. duration (ms)
            <input
              type="number"
              min={0}
              step={100}
              value={item.transition_duration}
              onChange={(e) => onUpdate(item.id, 'transition_duration', Number(e.target.value))}
              className="w-20 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="text-gray-500 hover:text-red-400 text-xl transition-colors flex-shrink-0 mt-1"
        title="Remove"
      >
        ✕
      </button>
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

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      await playlistApi.update(id, { title: titleDraft, description: descDraft })
      setDirty(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>
  }

  if (!playlist) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">{error ?? 'Not found'}</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">Editing Playlist</p>
          <h1 className="text-2xl font-bold text-gray-100">{titleDraft || 'Untitled'}</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link
            to={`/playlists/${id}/play`}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            ▶ Play
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Metadata panel */}
      <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-5 mb-6">
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => { setTitleDraft(e.target.value); setDirty(true) }}
          className="w-full text-2xl font-bold text-gray-100 bg-transparent border-0 border-b border-gray-700 focus:border-indigo-500 focus:outline-none pb-1 mb-3"
          placeholder="Playlist title"
        />
        <textarea
          value={descDraft}
          onChange={(e) => { setDescDraft(e.target.value); setDirty(true) }}
          className="w-full text-sm text-gray-400 bg-transparent border-0 focus:outline-none resize-none"
          placeholder="Description (optional)"
          rows={2}
        />
      </div>

      {/* Items section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-100">
          Items <span className="text-gray-500 font-normal text-base">({items.length})</span>
        </h2>
        <button
          onClick={() => setShowMedia(!showMedia)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Add Media
        </button>
      </div>

      {/* Media picker panel */}
      {showMedia && (
        <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-200">Select media to add</span>
            <button
              onClick={() => setShowMedia(false)}
              className="text-gray-400 hover:text-gray-200 text-lg leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto bg-gray-900">
            <MediaLibrary
              selectionMode
              selectedIds={new Set(items.map((i) => i.media_file_id))}
              onSelect={(file) => {
                handleMediaSelect(file)
              }}
            />
          </div>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="bg-gray-800 ring-1 ring-gray-700 rounded-xl px-5 py-12 text-center text-gray-500">
          No items yet. Click "+ Add Media" to get started.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  onUpdate={handleItemUpdate}
                  onRemove={handleItemRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
