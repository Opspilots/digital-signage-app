import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playlistApi, screenApi, BASE_URL } from '../api/client'
import type { Playlist, PlaylistItem } from '../api/types'
import { jsDowToBit } from '../utils/schedule'

const HEARTBEAT_INTERVAL_MS = 30_000
const HUD_TIMEOUT_MS        = 3000
const SCHEDULE_CHECK_MS     = 30_000

function isItemActiveNow(item: PlaylistItem, now: Date): boolean {
  const mask = item.days_of_week ?? 0
  if (mask !== 0) {
    const dowBit = jsDowToBit(now.getDay())
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
  const [networkOk, setNetworkOk] = useState(true)
  const [mediaLoading, setMediaLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatFailsRef = useRef(0)

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

  // Adaptive heartbeat: 30s when healthy, backoff to 5s after a failure, 30s again on recovery.
  useEffect(() => {
    if (!screenToken) return

    let cancelled = false

    const scheduleNext = (ms: number) => {
      if (cancelled) return
      heartbeatRef.current = setTimeout(sendHeartbeat, ms)
    }

    const sendHeartbeat = () => {
      if (heartbeatRef.current) clearTimeout(heartbeatRef.current)
      screenApi.heartbeat(screenToken)
        .then((data) => {
          if (cancelled) return
          heartbeatFailsRef.current = 0
          setNetworkOk(true)
          if (data.current_playlist_id && data.current_playlist_id !== currentPlaylistIdRef.current) {
            setCurrentPlaylistId(data.current_playlist_id)
          }
          scheduleNext(HEARTBEAT_INTERVAL_MS)
        })
        .catch(() => {
          if (cancelled) return
          heartbeatFailsRef.current += 1
          if (heartbeatFailsRef.current >= 2) setNetworkOk(false)
          // Faster retries while flaky (5s, then back to 30s once recovered)
          scheduleNext(5000)
        })
    }

    const handleOnline = () => {
      heartbeatFailsRef.current = 0
      setNetworkOk(true)
      if (heartbeatRef.current) clearTimeout(heartbeatRef.current)
      sendHeartbeat()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)

    sendHeartbeat()

    return () => {
      cancelled = true
      if (heartbeatRef.current) clearTimeout(heartbeatRef.current)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToken])

  const goTo = useCallback((index: number) => {
    setMediaLoading(true)
    setCurrentIndex(index)
    setTransitionKey((k) => k + 1)
  }, [])

  // Refresh schedule check periodically so items become (in)active without reload
  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), SCHEDULE_CHECK_MS)
    return () => clearInterval(t)
  }, [])

  const activeItems = items.filter((it) => isItemActiveNow(it, nowTick))
  const activeItemsRef = useRef(activeItems)
  useEffect(() => { activeItemsRef.current = activeItems }, [activeItems])

  useEffect(() => {
    if (currentIndex >= activeItems.length) setCurrentIndex(0)
  }, [activeItems.length, currentIndex])

  const scheduleAdvance = useCallback((durationSec: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1 < activeItemsRef.current.length ? prev + 1 : 0
        setTransitionKey((k) => k + 1)
        return next
      })
    }, durationSec * 1000)
  }, [])

  useEffect(() => {
    if (activeItems.length === 0) return
    const item = activeItems[currentIndex]
    if (!item) return

    if (timerRef.current) clearTimeout(timerRef.current)

    const isVideoOrAudio = item.media_file?.mime_type.startsWith('video/') || item.media_file?.mime_type.startsWith('audio/')
    if (!isVideoOrAudio) {
      // Images and other non-video/audio items: advance after display_duration
      scheduleAdvance(item.display_duration)
    }
    // For video/audio items the timer is set in onLoadedMetadata using Math.max(display_duration, mediaDuration).
    // onEnded also advances immediately when the media finishes naturally.

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, activeItems, scheduleAdvance])

  // Preload the next image so it appears instantly when the timer fires
  useEffect(() => {
    if (activeItems.length < 2) return
    const nextIndex = (currentIndex + 1) % activeItems.length
    const nextItem = activeItems[nextIndex]
    if (nextItem?.media_file && nextItem.media_file.mime_type.startsWith('image/')) {
      const img = new Image()
      img.src = `${BASE_URL}${nextItem.media_file.url}`
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeItems])

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
  const isAudio = currentItem.media_file?.mime_type.startsWith('audio/')
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
          preload="auto"
          onLoadedData={() => setMediaLoading(false)}
          onLoadedMetadata={(e) => {
            // Respect the longer of the configured duration and the actual video length
            const videoDuration = (e.target as HTMLVideoElement).duration
            const effectiveDuration = Math.max(currentItem.display_duration, isFinite(videoDuration) ? videoDuration : 0)
            scheduleAdvance(effectiveDuration)
          }}
          onEnded={() => goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0)}
          onError={() => { setMediaLoading(false); goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0) }}
        />
      ) : isAudio ? (
        <div
          key={`${transitionKey}-audio`}
          className={`flex flex-col items-center justify-center gap-6 w-full h-full px-8 ${animationClass}`}
          style={animationStyle}
        >
          {/* Music icon */}
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <p className="text-white text-lg font-medium text-center truncate max-w-md" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {currentItem.media_file?.original_name ?? ''}
          </p>
          <audio
            autoPlay
            muted={muted}
            src={currentItem.media_file ? `${BASE_URL}${currentItem.media_file.url}` : ''}
            onLoadedData={() => setMediaLoading(false)}
            onLoadedMetadata={(e) => {
              const audioDuration = (e.target as HTMLAudioElement).duration
              const effectiveDuration = Math.max(currentItem.display_duration, isFinite(audioDuration) ? audioDuration : 0)
              scheduleAdvance(effectiveDuration)
            }}
            onEnded={() => goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0)}
            onError={() => { setMediaLoading(false); goTo(currentIndex + 1 < activeItems.length ? currentIndex + 1 : 0) }}
          />
        </div>
      ) : (
        <img
          key={`${transitionKey}-img`}
          src={currentItem.media_file ? `${BASE_URL}${currentItem.media_file.url}` : ''}
          alt={currentItem.media_file?.original_name ?? ''}
          className={`max-w-full max-h-screen object-contain ${animationClass}`}
          style={animationStyle}
          onLoadStart={() => setMediaLoading(true)}
          onLoad={() => setMediaLoading(false)}
          onError={() => {
            setMediaLoading(false)
            if (activeItems.length > 1) goTo((currentIndex + 1) % activeItems.length)
          }}
        />
      )}

      {/* Loading spinner — shown while media is buffering */}
      {mediaLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* Persistent offline badge (visible regardless of HUD) */}
      {screenToken && !networkOk && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg pointer-events-none"
          style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)', backdropFilter: 'blur(6px)', zIndex: 10 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
          Sin conexión
        </div>
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
            {(isVideo || isAudio) && (
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
