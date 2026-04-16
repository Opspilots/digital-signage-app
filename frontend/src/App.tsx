import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, NavLink, Outlet } from 'react-router-dom'
import Home from './pages/Home'
import MediaLibrary from './pages/MediaLibrary'
import PlaylistEditor from './pages/PlaylistEditor'
import PlaylistPlayer from './pages/PlaylistPlayer'
import Screens from './pages/Screens'
import Login from './pages/Login'
import { isAuthenticated, onAuthChange, refresh, logout } from './auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [authed, setAuthed] = useState(isAuthenticated())
  const [restoring, setRestoring] = useState(!isAuthenticated())

  useEffect(() => {
    // On mount, try to restore the session from the stored refresh token
    if (!isAuthenticated()) {
      refresh()
        .then(() => setAuthed(true))
        .catch(() => {/* no stored session, will redirect to login */})
        .finally(() => setRestoring(false))
    } else {
      setRestoring(false)
    }
  }, [])

  useEffect(() => onAuthChange(() => setAuthed(isAuthenticated())), [])

  if (restoring) return null  // wait before deciding to redirect

  if (!authed) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

function AppLayout() {
  const navigate = useNavigate()

  const navLinks = [
    { to: '/playlists', label: 'Playlists', exact: false },
    { to: '/media', label: 'Media Library', exact: false },
    { to: '/screens', label: 'Screens', exact: false },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-60 bg-gray-900 border-r border-gray-800 flex flex-col z-10">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-gray-800">
          <span className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <span className="text-indigo-400">▣</span> SignageOS
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navLinks.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors w-full text-left"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 min-h-screen bg-gray-950 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* PlaylistPlayer is public — screens authenticate with their own screen token */}
        <Route path="/playlists/:id/play" element={<PlaylistPlayer />} />
        {/* Authenticated layout routes */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="/playlists" element={<Home />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/playlists/:id/edit" element={<PlaylistEditor />} />
          <Route path="/screens" element={<Screens />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
