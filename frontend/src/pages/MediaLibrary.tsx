import { useEffect, useRef, useState, useCallback } from 'react'
import { mediaApi } from '../api/client'
import type { MediaFile } from '../api/types'
import { useToast } from '../toast'

interface Props {
  selectionMode?: boolean
  selectedIds?: Set<string>
  onSelect?: (file: MediaFile) => void
}

export default function MediaLibrary({ selectionMode, selectedIds, onSelect }: Props) {
  const [files,     setFiles]     = useState<MediaFile[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const [search,    setSearch]    = useState('')
  const [multiSel,  setMultiSel]  = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const BASE_URL = import.meta.env.VITE_API_URL ?? ''
  const toast = useToast()

  const filteredFiles = search.trim()
    ? files.filter((f) => f.original_name.toLowerCase().includes(search.trim().toLowerCase()))
    : files

  const load = useCallback(() => {
    setLoading(true)
    mediaApi.list().then(setFiles).catch((e) => setError(String(e))).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true)
    try {
      const uploaded = await Promise.all(filesToUpload.map((f) => mediaApi.upload(f)))
      setFiles((prev) => [...uploaded, ...prev])
      if (!selectionMode) toast.success(`${uploaded.length} archivo${uploaded.length !== 1 ? 's' : ''} subido${uploaded.length !== 1 ? 's' : ''}`)
    } catch (e) { setError(String(e)) }
    finally { setUploading(false) }
  }

  const toggleMultiSel = (id: string) => {
    setMultiSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (multiSel.size === 0) return
    if (!confirm(`¿Eliminar ${multiSel.size} archivo${multiSel.size !== 1 ? 's' : ''}?`)) return
    const ids = Array.from(multiSel)
    try {
      await Promise.all(ids.map((id) => mediaApi.delete(id)))
      setFiles((prev) => prev.filter((f) => !multiSel.has(f.id)))
      toast.success(`${ids.length} archivo${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`)
      setMultiSel(new Set())
    } catch (e) { setError(String(e)) }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) uploadFiles(picked)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    )
    if (dropped.length) uploadFiles(dropped)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este archivo?')) return
    try {
      await mediaApi.delete(id)
      setFiles((prev) => prev.filter((f) => f.id !== id))
      if (!selectionMode) toast.success('Archivo eliminado')
    } catch (e) { setError(String(e)) }
  }

  const isVideo = (f: MediaFile) => f.mime_type.startsWith('video/')

  const ext = (f: MediaFile) => {
    const parts = f.original_name.split('.')
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '?'
  }

  return (
    <div className={selectionMode ? '' : 'p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto'}>
      {!selectionMode && (
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
          <div>
            <h1 className="font-display font-700 text-2xl" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>
              Biblioteca multimedia
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>{files.length} archivo{files.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {multiSel.size > 0 && (
              <>
                <button onClick={handleBulkDelete}
                  className="text-sm px-3 py-2 rounded-lg font-500 transition-colors"
                  style={{ color: 'var(--red)', background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.3)' }}
                >
                  Eliminar {multiSel.size}
                </button>
                <button onClick={() => setMultiSel(new Set())}
                  className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--text2)' }}
                >
                  Cancelar
                </button>
              </>
            )}
            <button onClick={() => fileInputRef.current?.click()} className="ds-btn">
              Subir
            </button>
          </div>
        </div>
      )}

      {selectionMode && (
        <p className="text-xs font-500 px-4 pt-4 mb-3 uppercase tracking-widest" style={{ color: 'var(--cyan)', letterSpacing: '0.08em' }}>
          Pulsa para añadir a la lista
        </p>
      )}

      {/* Search */}
      {files.length > 0 && (
        <div className={`mb-4 relative ${selectionMode ? 'mx-4' : ''}`}>
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
            placeholder="Buscar archivos…"
            className="ds-input"
            style={{ paddingLeft: 36 }}
          />
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors mb-6 ${selectionMode ? 'mx-4 p-6' : 'p-10'}`}
        style={{
          borderColor: dragOver ? 'var(--cyan-dim)' : 'var(--border)',
          background:  dragOver ? 'var(--cyan-muted)' : 'var(--surface2)',
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileInput} />
        <div className="flex flex-col items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: dragOver ? 'var(--cyan)' : 'var(--text2)' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p className="text-sm" style={{ color: dragOver ? 'var(--cyan)' : 'var(--text2)' }}>
            {uploading ? 'Subiendo…' : 'Suelta archivos o haz clic para subir'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>Imágenes y vídeos</p>
        </div>
      </div>

      {error && (
        <div className={`rounded-lg px-4 py-3 text-sm mb-4 ${selectionMode ? 'mx-4' : ''}`}
          style={{ background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.15)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text2)' }}>Cargando…</div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text2)' }}>Aún no hay archivos.</div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text2)' }}>Sin resultados para "{search}".</div>
      ) : (
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 ${selectionMode ? 'px-4 pb-4' : ''}`}>
          {filteredFiles.map((file) => {
            const selected = selectedIds?.has(file.id)
            const checked  = multiSel.has(file.id)
            const onCardClick = () => {
              if (selectionMode) { onSelect?.(file); return }
              if (multiSel.size > 0) toggleMultiSel(file.id)
            }
            return (
              <div
                key={file.id}
                className="relative group rounded-xl overflow-hidden cursor-pointer transition-all"
                style={{
                  border: (selected || checked) ? '2px solid var(--cyan)' : '1px solid var(--border)',
                  background: 'var(--surface)',
                  boxShadow: (selected || checked) ? '0 0 0 1px var(--cyan)' : 'none',
                }}
                onClick={onCardClick}
                onMouseEnter={e => { if (!selected && !checked) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)' }}
                onMouseLeave={e => { if (!selected && !checked) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
              >
                {/* Thumbnail */}
                <div className="aspect-video relative overflow-hidden" style={{ background: 'var(--surface2)' }}>
                  <img
                    src={`${BASE_URL}${file.thumbnail_url ?? file.url}`}
                    alt={file.original_name}
                    className="w-full h-full object-cover"
                  />
                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded font-500"
                      style={{
                        background: isVideo(file) ? 'rgba(34,211,238,0.15)' : 'rgba(52,211,153,0.15)',
                        color: isVideo(file) ? 'var(--cyan)' : 'var(--green)',
                        backdropFilter: 'blur(4px)',
                      }}>
                      {isVideo(file) ? '▶' : '⬜'} {ext(file)}
                    </span>
                  </div>
                  {(selected || checked) && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-700"
                      style={{ background: 'var(--cyan)', color: '#000' }}>✓</div>
                  )}
                  {/* Selection checkbox (shown on hover or when selection is active) */}
                  {!selectionMode && !checked && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleMultiSel(file.id) }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}
                      title="Seleccionar para acción masiva"
                      aria-label="Seleccionar"
                    />
                  )}
                  {/* Delete overlay */}
                  {!selectionMode && multiSel.size === 0 && (
                    <div className="absolute inset-0 flex items-end justify-start p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id) }}
                        className="text-xs px-2 py-1 rounded-lg font-500"
                        style={{ background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.3)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* Filename */}
                <div className="px-2.5 py-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs truncate font-500" style={{ color: 'var(--text1)' }} title={file.original_name}>
                    {file.original_name}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
