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
import { playlistApi, itemApi } from '../api/client'
import type { Playlist, PlaylistItem } from '../api/types'
import MediaLibrary from './MediaLibrary'
import type { MediaFile } from '../api/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

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
      className="bg-white border border-gray-200 rounded-lg flex items-start gap-3 p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
        title="Drag to reorder"
      >
        ⠿
      </button>

      <div className="w-20 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-100">
        {item.media_file && (
          isVideo ? (
            <video
              src={`${BASE_URL}${item.media_file.url}`}
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <img
              src={`${BASE_URL}${item.media_file.url}`}
              alt={item.media_file.original_name}
              className="w-full h-full object-cover"
            />
          )
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {item.media_file?.original_name ?? item.media_file_id}
        </p>

        <div className="flex flex-wrap gap-3 mt-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Duration (s)
            <input
              type="number"
              min={1}
              value={item.display_duration}
              onChange={(e) => onUpdate(item.id, 'display_duration', Number(e.target.value))}
              className="w-16 border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Transition
            <select
              value={item.transition_type}
              onChange={(e) => onUpdate(item.id, 'transition_type', e.target.value)}
              className="border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Trans. duration (ms)
            <input
              type="number"
              min={0}
              step={100}
              value={item.transition_duration}
              onChange={(e) => onUpdate(item.id, 'transition_duration', Number(e.target.value))}
              className="w-20 border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="text-red-400 hover:text-red-600 text-sm flex-shrink-0 mt-1"
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
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i))
    )
    try {
      await itemApi.update(id!, itemId, { [field]: value } as Partial<PlaylistItem>)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleItemRemove = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    try {
      await itemApi.remove(id!, itemId)
    } catch (e) {
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
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading…</div>
  }

  if (!playlist) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">{error ?? 'Not found'}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">← Home</Link>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600">Editing playlist</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link
            to={`/playlists/${id}/play`}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            ▶ Play
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => { setTitleDraft(e.target.value); setDirty(true) }}
            className="w-full text-2xl font-bold text-gray-900 border-0 border-b border-transparent focus:border-blue-400 focus:outline-none pb-1 mb-3"
            placeholder="Playlist title"
          />
          <textarea
            value={descDraft}
            onChange={(e) => { setDescDraft(e.target.value); setDirty(true) }}
            className="w-full text-sm text-gray-600 border-0 focus:outline-none resize-none"
            placeholder="Description (optional)"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Items ({items.length})
          </h2>
          <button
            onClick={() => setShowMedia(!showMedia)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Add media
          </button>
        </div>

        {showMedia && (
          <div className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Select media to add</span>
              <button onClick={() => setShowMedia(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
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

        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-12 bg-white border border-gray-200 rounded-lg">
            No items yet. Click "+ Add media" to get started.
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
      </main>
    </div>
  )
}
