import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playlistApi, screenApi, BASE_URL } from '../api/client'
import type { Playlist, PlaylistItem } from '../api/types'

const HEARTBEAT_INTERVAL_MS = 30_000
const HUD_TIMEOUT_MS        = 3000
const SCHEDULE_CHECK_MS     = 30_000

function isItemActiveNow(item: PlaylistItem, now: Date): boolean {
  const mask = item.days_of_week ?? 0
  if (mask !== 0) {
    const jsDow = now.getDay()          // 0=Sun
    const dowBit = jsDow === 0 ? 64 : (1 << (jsDow - 1))
    if ((mask & dowBit) === 0) return false
  }
  const toMin = (t?: string | null) => {
    if (!t) return null
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const start = toMin(item.start_time)
  const end   = toMin(item.end_time)
  if (start === null && end === null) return true
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (start !== null && nowMin < start) return false
  if (end !== null && nowMin >= end) return false
  return true
}

export default function PlaylistPlayer() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const screenToken = searchParams.get('screen') ?? undefined
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | undefined>(id)
  const currentPlaylistIdRef = useRef(currentPlaylistId)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [nowTick, setNowTick] = useState(() => new Date())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHud, setShowHud] = useState(true)
  const [transitionKey, setTransitionKey] = useState(0)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    currentPlaylistIdRef.current = currentPlaylistId
  }, [currentPlaylistId])

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

  useEffect(() => {
    if (!screenToken) return

    const sendHeartbeat = () => {
      screenApi.heartbeat(screenToken).then((data) => {
        if (data.current_playlist_id && data.current_playlist_id !== currentPlaylistIdRef.current) {
          setCurrentPlaylistId(data.current_playlist_id)
        }
      }).catch(() => {})
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

  // Refresh schedule check periodically so items become (in)active without reload
  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), SCHEDULE_CHECK_MS)
    return () => clearInterval(t)
  }, [])

  const activeItems = items.filter((it) => isItemActiveNow(it, nowTick))

  useEffect(() => {
    if (currentIndex >= activeItems.length) setCurrentIndex(0)
  }, [activeItems.length, currentIndex])

  useEffect(() => {
    if (activeItems.length === 0) return
    const item = activeItems[currentIndex]
    if (!item) return

    if (timerRef.current) clearTimeout(timerRef.current)

    const isVideo = item.media_file?.mime_type.startsWith('video/')
    if (!isVideo) {
      timerRef.current = setTimeout(() => {
        const nextIdx = currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0
        goTo(nextIdx)
      }, item.display_duration * 1000)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, activeItems, goTo])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) navigate(-1)
      if (e.key === 'ArrowRight') goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0)
      if (e.key === 'ArrowLeft') goTo(currentIndex - 1 >= 0 ? currentIndex - 1 : activeItems.length - 1)
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === 'm' || e.key === 'M') setMuted((m) => !m)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeItems.length, navigate, currentIndex, goTo, toggleFullscreen])

  const bumpHud = useCallback(() => {
    setShowHud(true)
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current)
    hudTimerRef.current = setTimeout(() => setShowHud(false), HUD_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    bumpHud()
  }, [bumpHud])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = muted
    }
  }, [volume, muted, currentIndex])

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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4 px-6 text-center">
        <p className="text-gray-400">Esta lista no tiene elementos.</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 text-sm">
          ← Volver
        </button>
      </div>
    )
  }

  if (activeItems.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4 px-6 text-center">
        <p className="text-gray-300">Ningún contenido programado ahora.</p>
        <p className="text-gray-500 text-sm">La lista tiene elementos, pero ninguno está activo en este día/horario.</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 text-sm">
          ← Volver
        </button>
      </div>
    )
  }

  const currentItem = activeItems[currentIndex] ?? activeItems[0]
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

  const animationStyle =
    transitionType !== 'none'
      ? { animationDuration: `${transDuration}ms` }
      : {}

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden select-none"
      onMouseMove={bumpHud}
      onTouchStart={bumpHud}
    >
      {isVideo ? (
        <video
          key={`${transitionKey}-video`}
          ref={videoRef}
          src={currentItem.media_file ? `${BASE_URL}${currentItem.media_file.url}` : ''}
          className={`max-w-full max-h-screen object-contain ${animationClass}`}
          style={animationStyle}
          autoPlay
          muted={muted}
          playsInline
          onEnded={() => goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0)}
          onError={() => goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0)}
        />
      ) : (
        <img
          key={`${transitionKey}-img`}
          src={currentItem.media_file ? `${BASE_URL}${currentItem.media_file.url}` : ''}
          alt={currentItem.media_file?.original_name ?? ''}
          className={`max-w-full max-h-screen object-contain ${animationClass}`}
          style={animationStyle}
        />
      )}

      {/* HUD */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between gap-3 p-3 sm:p-4"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="pointer-events-auto flex items-center gap-1.5 text-white text-sm px-3 py-2 rounded-lg backdrop-blur"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
            title="Volver (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span className="hidden sm:inline">Volver</span>
          </button>
          <div className="min-w-0 text-right">
            <p className="text-white font-semibold text-base sm:text-lg truncate">{playlist.title}</p>
            <p className="text-gray-300 text-xs sm:text-sm mt-0.5 truncate">
              {currentItem.media_file?.original_name}
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 p-3 sm:p-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
        >
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => goTo(currentIndex - 1 >= 0 ? currentIndex - 1 : activeItems.length - 1)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
              title="Anterior (←)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
              </svg>
            </button>
            <button
              onClick={() => goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
              title="Siguiente (→)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
              </svg>
            </button>
            <span className="text-white text-sm font-mono px-2">
              {currentIndex + 1} / {activeItems.length}
            </span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {isVideo && (
              <>
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
                  title={muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
                >
                  {muted ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setVolume(v)
                    setMuted(v === 0)
                  }}
                  className="hidden sm:block"
                  style={{ width: 80, accentColor: 'var(--cyan)' }}
                  title="Volumen"
                />
              </>
            )}
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
              title={isFullscreen ? 'Salir pantalla completa (F)' : 'Pantalla completa (F)'}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
