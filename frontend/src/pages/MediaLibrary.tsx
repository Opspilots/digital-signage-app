import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
  const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

  return (
    <div className="min-h-screen bg-gray-50">
      {!selectionMode && (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Home
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          </div>
        </header>
      )}

      <main className={selectionMode ? 'p-4' : 'max-w-6xl mx-auto px-6 py-8'}>
        {selectionMode && (
          <p className="text-sm text-blue-600 font-medium mb-4">
            Click items to add them to the playlist
          </p>
        )}

        <div
          className={`border-2 border-dashed rounded-xl p-6 mb-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
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
          <p className="text-gray-500 text-sm">
            {uploading ? 'Uploading…' : 'Drop files here or click to upload (images & videos)'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading…</div>
        ) : files.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No media files yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map((file) => {
              const selected = selectedIds?.has(file.id)
              return (
                <div
                  key={file.id}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    selected
                      ? 'border-blue-500 ring-2 ring-blue-300'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => selectionMode && onSelect?.(file)}
                >
                  {isVideo(file) ? (
                    <video
                      src={`${BASE_URL}${file.url}`}
                      className="w-full aspect-video object-cover bg-black"
                      muted
                    />
                  ) : (
                    <img
                      src={file.thumbnail_url ? `${BASE_URL}${file.thumbnail_url}` : `${BASE_URL}${file.url}`}
                      alt={file.original_name}
                      className="w-full aspect-video object-cover bg-gray-100"
                    />
                  )}

                  {selected && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}

                  <div className="p-2 bg-white">
                    <p className="text-xs text-gray-600 truncate" title={file.original_name}>
                      {file.original_name}
                    </p>
                  </div>

                  {!selectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(file.id) }}
                      className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
