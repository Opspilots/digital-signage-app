import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { scheduleApi, playlistApi, screenApi } from '../api/client'
import type { Schedule, Playlist, Screen } from '../api/types'

const DAYS    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_BITS = [1, 2, 4, 8, 16, 32, 64]

function daysLabel(mask: number): string {
  if (mask === 127) return 'Todos los días'
  if (mask === 31)  return 'Entre semana'
  if (mask === 96)  return 'Fines de semana'
  return DAYS.filter((_, i) => mask & DAY_BITS[i]).join(', ')
}

export default function ScreenSchedules() {
  const { screenId } = useParams<{ screenId: string }>()
  const [screen,     setScreen]    = useState<Screen | null>(null)
  const [schedules,  setSchedules] = useState<Schedule[]>([])
  const [playlists,  setPlaylists] = useState<Playlist[]>([])
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState<string | null>(null)
  const [warning,    setWarning]   = useState<string | null>(null)
  const [showForm,   setShowForm]  = useState(false)
  const [submitting, setSubmitting]= useState(false)

  const [form, setForm] = useState({ playlist_id: '', days_of_week: 31, start_time: '09:00', end_time: '18:00', priority: 0 })

  useEffect(() => {
    if (!screenId) return
    Promise.all([screenApi.get(screenId), scheduleApi.list(screenId), playlistApi.list()])
      .then(([s, scheds, pl]) => {
        setScreen(s); setSchedules(scheds); setPlaylists(pl)
        if (pl.length > 0) setForm((f) => ({ ...f, playlist_id: pl[0].id }))
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [screenId])

  const toggleDay = (bit: number) => setForm((f) => ({ ...f, days_of_week: f.days_of_week ^ bit }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!screenId || !form.playlist_id || form.days_of_week === 0) return
    setSubmitting(true); setWarning(null)
    try {
      const result = await scheduleApi.create(screenId, form)
      if (result.warnings?.length) setWarning(result.warnings[0])
      setSchedules((prev) => [...prev, result])
      setShowForm(false)
    } catch (e) { setError(String(e)) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (scheduleId: string) => {
    if (!screenId || !confirm('¿Eliminar este horario?')) return
    try {
      await scheduleApi.delete(screenId, scheduleId)
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
    } catch (e) { setError(String(e)) }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text2)' }}>Cargando…</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link to="/screens" className="text-sm transition-colors" style={{ color: 'var(--text2)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text1)')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)')}
        >← Pantallas</Link>
        <span style={{ color: 'var(--text3)' }}>/</span>
        <h1 className="font-display font-700 text-xl" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>
          {screen?.name ?? screenId}
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full font-500" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>
          Horarios
        </span>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.15)', color: 'var(--red)' }}>
          {error}
        </div>
      )}
      {warning && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: 'var(--amber-muted)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--amber)' }}>
          ⚠ {warning}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: 'var(--text2)' }}>
          {schedules.length === 0 ? 'No hay horarios configurados.' : `${schedules.length} horario${schedules.length !== 1 ? 's' : ''}`}
        </p>
        <button onClick={() => setShowForm(!showForm)} className="ds-btn">+ Añadir horario</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="ds-card p-5 mb-6 space-y-4 animate-slide-up">
          <p className="font-display font-600 text-sm" style={{ color: 'var(--text1)' }}>Nuevo horario</p>

          <div>
            <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Lista</label>
            <select value={form.playlist_id} onChange={(e) => setForm((f) => ({ ...f, playlist_id: e.target.value }))} required className="ds-input">
              <option value="">Selecciona una lista…</option>
              {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-500 mb-2 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Días</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((day, i) => {
                const bit    = DAY_BITS[i]
                const active = !!(form.days_of_week & bit)
                return (
                  <button key={day} type="button" onClick={() => toggleDay(bit)}
                    className="px-3 py-1.5 rounded-lg text-xs font-500 transition-colors"
                    style={active
                      ? { background: 'var(--cyan-muted)', color: 'var(--cyan)', border: '1px solid var(--cyan-dim)' }
                      : { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }
                    }
                  >{day}</button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            {(['start_time', 'end_time'] as const).map((field) => (
              <div key={field} className="flex-1">
                <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>
                  {field === 'start_time' ? 'Inicio' : 'Fin'}
                </label>
                <input type="time" value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} required className="ds-input" />
              </div>
            ))}
            <div className="w-24">
              <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Prioridad</label>
              <input type="number" min={0} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} className="ds-input" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={submitting || form.days_of_week === 0} className="ds-btn">
              {submitting ? 'Guardando…' : 'Guardar horario'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Cancelar</button>
          </div>
        </form>
      )}

      {schedules.length > 0 && (
        <ul className="space-y-2 animate-fade-in">
          {schedules.map((s) => (
            <li key={s.id} className="ds-card px-5 py-4 flex items-center justify-between gap-4 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="min-w-0">
                <p className="font-500 truncate" style={{ color: 'var(--text1)' }}>{s.playlist_title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                  {daysLabel(s.days_of_week)} · {s.start_time}–{s.end_time}
                  {s.priority > 0 && <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>p{s.priority}</span>}
                </p>
              </div>
              <button onClick={() => handleDelete(s.id)}
                className="text-sm flex-shrink-0 transition-colors" style={{ color: 'var(--text2)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
              >Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
