import { useEffect, useState } from 'react'
import { userApi } from '../api/client'
import { getCurrentUser } from '../auth'
import type { User } from '../api/types'

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const currentUser = getCurrentUser()

  const [form, setForm] = useState({ username: '', password: '', role: 'editor', email: '' })

  useEffect(() => {
    userApi.list()
      .then(setUsers)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const user = await userApi.create({
        username: form.username,
        password: form.password,
        role: form.role,
        email: form.email || undefined,
      })
      setUsers((prev) => [...prev, user])
      setForm({ username: '', password: '', role: 'editor', email: '' })
      setShowForm(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const updated = await userApi.update(userId, { role: newRole })
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
    } catch (e) {
      setError(String(e))
    } finally {
      setEditingRole(null)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user?')) return
    try {
      await userApi.delete(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (e) {
      setError(String(e))
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Users</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + New User
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-gray-800 ring-1 ring-gray-700 rounded-xl p-5 mb-6 space-y-3"
        >
          <h2 className="text-sm font-semibold text-gray-200">New User</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email (optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create User'}
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

      <ul className="space-y-3">
        {users.map((user) => {
          const isSelf = user.id === currentUser?.sub
          return (
            <li
              key={user.id}
              className="bg-gray-800 ring-1 ring-gray-700 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-100">{user.username}</span>
                  {isSelf && <span className="text-xs text-indigo-400 font-medium">(you)</span>}
                </div>
                {user.email && <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>}
                <p className="text-xs text-gray-500 mt-0.5">
                  Since {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {editingRole === user.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="bg-gray-700 border border-gray-600 text-gray-100 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => setEditingRole(null)}
                      className="text-xs text-gray-400 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingRole(user.id)}
                    className={`text-xs px-2 py-1 rounded-md font-medium ${
                      user.role === 'admin'
                        ? 'bg-indigo-900 text-indigo-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {user.role}
                  </button>
                )}
                {!isSelf && (
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-sm text-red-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
