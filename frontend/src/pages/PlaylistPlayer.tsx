import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playlistApi, screenApi, BASE_URL } from '../api/client'
import type { Playlist, PlaylistItem } from '../api/types'

const HEARTBEAT_INTERVAL_MS = 30_000

export default function PlaylistPlayer() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const screenToken = searchParams.get('screen') ?? undefined
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | undefined>(id)
  const currentPlaylistIdRef = useRef(currentPlaylistId)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHud, setShowHud] = useState(false)
  const [transitionKey, setTransitionKey] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep ref in sync so the heartbeat closure always reads the latest playlist id
  useEffect(() => {
    currentPlaylistIdRef.current = currentPlaylistId
  }, [currentPlaylistId])

  // Load playlist by id
  useEffect(() => {
    const playlistId = currentPlaylistId
    if (!playlistId) return
    setLoading(true)
    playlistApi
      .get(playlistId, screenToken)
      .then((p) => {
        setPlaylist(p)
        setItems(p.items ?? [])
        setCurrentIndex(0)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [currentPlaylistId])

  // Screen heartbeat polling
  useEffect(() => {
    if (!screenToken) return

    const sendHeartbeat = () => {
      screenApi.heartbeat(screenToken).then((data) => {
        if (data.current_playlist_id && data.current_playlist_id !== currentPlaylistIdRef.current) {
          setCurrentPlaylistId(data.current_playlist_id)
        }
      }).catch(() => {/* ignore heartbeat errors */})
    }

    sendHeartbeat()
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToken])

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
    setTransitionKey((k) => k + 1)
  }, [])

  // Auto-advance timer
  useEffect(() => {
    if (items.length === 0) return
    const item = items[currentIndex]
    if (!item) return

    if (timerRef.current) clearTimeout(timerRef.current)

    const isVideo = item.media_file?.mime_type.startsWith('video/')
    if (!isVideo) {
      timerRef.current = setTimeout(() => {
        const nextIdx = currentIndex + 1 < items.length ? currentIndex + 1 : 0
        goTo(nextIdx)
      }, item.display_duration * 1000)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, items, goTo])

  // Keyboard shortcuts — use goTo so the auto-advance timer is properly reset
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1)
      if (e.key === 'ArrowRight') goTo(currentIndex + 1 < items.length ? currentIndex + 1 : 0)
      if (e.key === 'ArrowLeft') goTo(currentIndex - 1 >= 0 ? currentIndex - 1 : items.length - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [items.length, navigate, currentIndex, goTo])

  // HUD on hover
  const handleMouseMove = () => {
    setShowHud(true)
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current)
    hudTimerRef.current = setTimeout(() => setShowHud(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Cargando…
      </div>
    )
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-400">
        {error ?? 'No encontrada'}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <p className="text-gray-400">Esta lista no tiene elementos.</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 text-sm">
          ← Volver
        </button>
      </div>
    )
  }

  const currentItem = items[currentIndex]
  const isVideo = currentItem.media_file?.mime_type.startsWith('video/')
  const transitionType = currentItem.transition_type
  const transDuration = currentItem.transition_duration

  const animationClass =
    transitionType === 'fade'
      ? 'transition-fade-enter'
      : transitionType === 'slide'
      ? 'transition-slide-enter'
      : transitionType === 'zoom-in'
      ? 'transition-zoom-in-enter'
      : transitionType === 'zoom-out'
      ? 'transition-zoom-out-enter'
      : transitionType === 'slide-left'
      ? 'transition-slide-left-enter'
      : transitionType === 'slide-up'
      ? 'transition-slide-up-enter'
      : transitionType === 'slide-down'
      ? 'transition-slide-down-enter'
      : transitionType === 'blur-in'
      ? 'transition-blur-in-enter'
      : transitionType === 'flip'
      ? 'transition-flip-enter'
      : transitionType === 'rotate-in'
      ? 'transition-rotate-in-enter'
      : transitionType === 'bounce-in'
      ? 'transition-bounce-in-enter'
      : transitionType === 'wipe-right'
      ? 'transition-wipe-right-enter'
      : ''

  const style =
    transitionType !== 'none'
      ? { animationDuration: `${transDuration}ms` }
      : {}

  return (
    <div
      className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden cursor-none"
      onMouseMove={handleMouseMove}
    >
      {isVideo ? (
        <video
          key={`${transitionKey}-video`}
          ref={videoRef}
          src={currentItem.media_file ? `${BASE_URL}${currentItem.media_file.url}` : ''}
          className={`max-w-full max-h-screen object-contain ${animationClass}`}
          style={style}
          autoPlay
          muted={false}
          onEnded={() => goTo(currentIndex + 1 < items.length ? currentIndex + 1 : 0)}
          onError={() => goTo(currentIndex + 1 < items.length ? currentIndex + 1 : 0)}
        />
      ) : (
        <img
          key={`${transitionKey}-img`}
          src={currentItem.media_file ? `${BASE_URL}${currentItem.media_file.url}` : ''}
          alt={currentItem.media_file?.original_name ?? ''}
          className={`max-w-full max-h-screen object-contain ${animationClass}`}
          style={style}
        />
      )}

      {/* HUD overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4">
          <p className="text-white font-semibold text-lg">{playlist.title}</p>
          <p className="text-gray-300 text-sm mt-0.5">
            {currentItem.media_file?.original_name}
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex items-center justify-between">
          <span className="text-white text-sm">
            {currentIndex + 1} / {items.length}
          </span>
          <span className="text-gray-300 text-xs">ESC para salir · ← → para navegar</span>
        </div>
      </div>
    </div>
  )
}
