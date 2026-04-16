import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { scheduleApi, playlistApi, screenApi } from '../api/client'
import type { Schedule, Playlist, Screen } from '../api/types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_BITS = [1, 2, 4, 8, 16, 32, 64]

function daysLabel(mask: number): string {
  const active = DAYS.filter((_, i) => mask & DAY_BITS[i])
  if (active.length === 7) return 'Every day'
  if (mask === 31) return 'Weekdays'
  if (mask === 96) return 'Weekends'
  return active.join(', ')
}

export default function ScreenSchedules() {
  const { screenId } = useParams<{ screenId: string }>()
  const [screen, setScreen] = useState<Screen | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    playlist_id: '',
    days_of_week: 31,
    start_time: '09:00',
    end_time: '18:00',
    priority: 0,
  })

  useEffect(() => {
    if (!screenId) return
    Promise.all([screenApi.get(screenId), scheduleApi.list(screenId), playlistApi.list()])
      .then(([s, scheds, pl]) => {
        setScreen(s)
        setSchedules(scheds)
        setPlaylists(pl)
        if (pl.length > 0) setForm((f) => ({ ...f, playlist_id: pl[0].id }))
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [screenId])

  const handleDayToggle = (bit: number) => {
    setForm((f) => ({ ...f, days_of_week: f.days_of_week ^ bit }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!screenId || !form.playlist_id || form.days_of_week === 0) return
    setSubmitting(true)
    setWarning(null)
    try {
      const result = await scheduleApi.create(screenId, form)
      if (result.warnings?.length) setWarning(result.warnings[0])
      setSchedules((prev) => [...prev, result])
      setShowForm(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (scheduleId: string) => {
    if (!screenId || !confirm('Delete this schedule?')) return
    try {
      await scheduleApi.delete(screenId, scheduleId)
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
    } catch (e) {
      setError(String(e))
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/screens" className="text-gray-400 hover:text-gray-200 text-sm">← Screens</Link>
        <span className="text-gray-600">/</span>
        <h1 className="text-xl font-bold text-gray-100">
          Schedules — <span className="text-indigo-400">{screen?.name ?? screenId}</span>
        </h1>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}
      {warning && (
        <div className="bg-yellow-950 border border-yellow-700 text-yellow-400 px-4 py-3 rounded-lg mb-4 text-sm">
          ⚠ {warning}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-400">
          {schedules.length === 0 ? 'No schedules yet.' : `${schedules.length} schedule(s)`}
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Add Schedule
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-5 mb-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-200">New Schedule</h2>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Playlist</label>
            <select
              value={form.playlist_id}
              onChange={(e) => setForm((f) => ({ ...f, playlist_id: e.target.value }))}
              required
              className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select playlist…</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">Days of week</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => {
                const bit = DAY_BITS[i]
                const active = !!(form.days_of_week & bit)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(bit)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Start time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                required
                className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                required
                className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <input
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || form.days_of_week === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save Schedule'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {schedules.length > 0 && (
        <ul className="space-y-3">
          {schedules.map((s) => (
            <li key={s.id} className="bg-gray-800 ring-1 ring-gray-700 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{s.playlist_title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {daysLabel(s.days_of_week)} · {s.start_time}–{s.end_time}
                  {s.priority > 0 && <span className="ml-2 text-indigo-400">Priority {s.priority}</span>}
                </p>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-red-500 hover:text-red-400 text-sm flex-shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
