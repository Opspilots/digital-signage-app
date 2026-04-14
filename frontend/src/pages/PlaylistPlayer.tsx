import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { playlistApi } from '../api/client'
import type { Playlist, PlaylistItem } from '../api/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export default function PlaylistPlayer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHud, setShowHud] = useState(false)
  const [transitionKey, setTransitionKey] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return
    playlistApi
      .get(id)
      .then((p) => {
        setPlaylist(p)
        setItems(p.items ?? [])
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1)
      if (e.key === 'ArrowRight') {
        setCurrentIndex((ci) => {
          const nextIdx = ci + 1 < items.length ? ci + 1 : 0
          setTransitionKey((k) => k + 1)
          return nextIdx
        })
      }
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((ci) => {
          const prevIdx = ci - 1 >= 0 ? ci - 1 : items.length - 1
          setTransitionKey((k) => k + 1)
          return prevIdx
        })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [items.length, navigate])

  // HUD on hover
  const handleMouseMove = () => {
    setShowHud(true)
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current)
    hudTimerRef.current = setTimeout(() => setShowHud(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading…
      </div>
    )
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-400">
        {error ?? 'Not found'}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <p className="text-gray-400">This playlist has no items.</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 text-sm">
          ← Go back
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
          onEnded={() => {
            const nextIdx = currentIndex + 1 < items.length ? currentIndex + 1 : 0
            goTo(nextIdx)
          }}
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
          <span className="text-gray-300 text-xs">ESC to exit · ← → to navigate</span>
        </div>
      </div>
    </div>
  )
}
