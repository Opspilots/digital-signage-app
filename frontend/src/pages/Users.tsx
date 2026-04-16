import { useEffect, useState } from 'react'
import { userApi } from '../api/client'
import { getCurrentUser } from '../auth'
import type { User } from '../api/types'

export default function Users() {
  const [users,      setUsers]      = useState<User[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRole,setEditingRole]= useState<string | null>(null)
  const currentUser = getCurrentUser()

  const [form, setForm] = useState({ username: '', password: '', role: 'editor', email: '' })

  useEffect(() => {
    userApi.list().then(setUsers).catch((e) => setError(String(e))).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(null)
    try {
      const user = await userApi.create({ username: form.username, password: form.password, role: form.role, email: form.email || undefined })
      setUsers((prev) => [...prev, user])
      setForm({ username: '', password: '', role: 'editor', email: '' })
      setShowForm(false)
    } catch (e) { setError(String(e)) }
    finally { setSubmitting(false) }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const updated = await userApi.update(userId, { role: newRole })
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
    } catch (e) { setError(String(e)) }
    finally { setEditingRole(null) }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user?')) return
    try { await userApi.delete(userId); setUsers((prev) => prev.filter((u) => u.id !== userId)) }
    catch (e) { setError(String(e)) }
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text2)' }}>Loading…</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-700 text-2xl" style={{ color: 'var(--text1)', letterSpacing: '-0.01em' }}>Users</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>{users.length} account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="ds-btn">+ New User</button>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.15)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="ds-card p-5 mb-6 space-y-4 animate-slide-up">
          <p className="font-display font-600 text-sm" style={{ color: 'var(--text1)' }}>New User</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Username</label>
              <input type="text" required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="ds-input" />
            </div>
            <div>
              <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Password</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="ds-input" />
            </div>
            <div>
              <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="ds-input">
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-500 mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text2)', letterSpacing: '0.08em' }}>Email (optional)</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="ds-input" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={submitting} className="ds-btn">
              {submitting ? 'Creating…' : 'Create User'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="space-y-2 animate-fade-in">
        {users.map((user) => {
          const isSelf = user.id === currentUser?.sub
          return (
            <li key={user.id} className="ds-card px-5 py-4 flex items-center justify-between gap-4 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 flex-shrink-0"
                  style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-500" style={{ color: 'var(--text1)' }}>{user.username}</span>
                    {isSelf && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>you</span>}
                  </div>
                  {user.email && <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>{user.email}</p>}
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>Since {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {editingRole === user.id ? (
                  <div className="flex items-center gap-2">
                    <select defaultValue={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="text-xs rounded-lg px-2.5 py-1.5"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', outline: 'none' }}>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => setEditingRole(null)} className="text-xs" style={{ color: 'var(--text2)' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingRole(user.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-500 transition-colors"
                    style={user.role === 'admin'
                      ? { background: 'var(--cyan-muted)', color: 'var(--cyan)', border: '1px solid var(--cyan-dim)' }
                      : { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }
                    }>
                    {user.role}
                  </button>
                )}
                {!isSelf && (
                  <button onClick={() => handleDelete(user.id)} className="text-sm transition-colors" style={{ color: 'var(--text2)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                  >Delete</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
