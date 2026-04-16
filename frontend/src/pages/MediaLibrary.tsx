import { useEffect, useRef, useState, useCallback } from 'react'
import { mediaApi } from '../api/client'
import type { MediaFile } from '../api/types'

interface Props {
  selectionMode?: boolean
  selectedIds?: Set<string>
  onSelect?: (file: MediaFile) => void
}

export default function MediaLibrary({ selectionMode, selectedIds, onSelect }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    mediaApi
      .list()
      .then(setFiles)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true)
    try {
      const uploaded = await Promise.all(filesToUpload.map((f) => mediaApi.upload(f)))
      setFiles((prev) => [...uploaded, ...prev])
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) uploadFiles(picked)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    )
    if (dropped.length) uploadFiles(dropped)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this file?')) return
    try {
      await mediaApi.delete(id)
      setFiles((prev) => prev.filter((f) => f.id !== id))
    } catch (e) {
      setError(String(e))
    }
  }

  const isVideo = (f: MediaFile) => f.mime_type.startsWith('video/')
  const BASE_URL = import.meta.env.VITE_API_URL ?? ''

  return (
    <div className={selectionMode ? '' : 'p-6 max-w-6xl mx-auto'}>
      {!selectionMode && (
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-100">Media Library</h1>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Upload
          </button>
        </div>
      )}

      {selectionMode && (
        <p className="text-sm text-indigo-400 font-medium mb-4 px-4 pt-4">
          Click items to add them to the playlist
        </p>
      )}

      {/* Dropzone */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 mb-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-indigo-500 bg-indigo-950/30'
            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        } ${selectionMode ? 'mx-4' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <p className="text-gray-400 text-sm">
          {uploading ? 'Uploading…' : 'Drop files here or click to upload (images & videos)'}
        </p>
      </div>

      {error && (
        <div className={`bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm ${selectionMode ? 'mx-4' : ''}`}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : files.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No media files yet.</div>
      ) : (
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 ${selectionMode ? 'px-4 pb-4' : ''}`}>
          {files.map((file) => {
            const selected = selectedIds?.has(file.id)
            return (
              <div
                key={file.id}
                className={`relative group rounded-xl overflow-hidden ring-2 transition-all cursor-pointer ${
                  selected
                    ? 'ring-indigo-500'
                    : 'ring-gray-700 hover:ring-gray-500'
                }`}
                onClick={() => selectionMode && onSelect?.(file)}
              >
                <img
                  src={`${BASE_URL}${file.thumbnail_url ?? file.url}`}
                  alt={file.original_name}
                  className="w-full aspect-video object-cover bg-gray-900"
                />

                {selected && (
                  <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                )}

                <div className="px-2.5 py-2 bg-gray-900">
                  <p className="text-xs text-gray-300 truncate" title={file.original_name}>
                    {file.original_name}
                  </p>
                </div>

                {!selectionMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(file.id) }}
                    className="absolute top-2 left-2 bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
