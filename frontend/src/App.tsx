import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, NavLink, Outlet } from 'react-router-dom'
import Home from './pages/Home'
import MediaLibrary from './pages/MediaLibrary'
import PlaylistEditor from './pages/PlaylistEditor'
import PlaylistPlayer from './pages/PlaylistPlayer'
import PairingScreen from './pages/PairingScreen'
import Screens from './pages/Screens'
import ScreenSchedules from './pages/ScreenSchedules'
import Login from './pages/Login'
import { isAuthenticated, onAuthChange, refresh, logout, getCurrentUser } from './auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location  = useLocation()
  const [authed,    setAuthed]    = useState(isAuthenticated())
  const [restoring, setRestoring] = useState(!isAuthenticated())

  useEffect(() => {
    if (!isAuthenticated()) {
      refresh()
        .then(() => setAuthed(true))
        .catch(() => {})
        .finally(() => setRestoring(false))
    } else {
      setRestoring(false)
    }
  }, [])

  useEffect(() => onAuthChange(() => setAuthed(isAuthenticated())), [])

  if (restoring) return null
  if (!authed) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

const icons: Record<string, React.ReactNode> = {
  playlists: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  media: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18"/>
      <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  screens: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
}

const navItems = [
  { to: '/playlists', label: 'Listas',     icon: icons.playlists },
  { to: '/media',     label: 'Multimedia', icon: icons.media },
  { to: '/screens',   label: 'Pantallas',  icon: icons.screens },
]

const SIDEBAR_W = 240
const TOPBAR_H  = 56

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--cyan)', fontSize: 20 }}>▣</span>
      <span className="font-display font-700 tracking-wide" style={{ color: 'var(--text1)', fontSize: 15 }}>
        SignageOS
      </span>
    </div>
  )
}

function AppLayout() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const currentUser = getCurrentUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen && !isDesktop ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, isDesktop])

  const showSidebar = isDesktop || menuOpen

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Mobile top bar */}
      {!isDesktop && (
        <header
          className="fixed inset-x-0 top-0 flex items-center justify-between px-4"
          style={{ height: TOPBAR_H, background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 40 }}
        >
          <Brand />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text1)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuOpen ? icons.close : icons.menu}
          </button>
        </header>
      )}

      {/* Overlay */}
      {!isDesktop && menuOpen && (
        <div
          className="fixed inset-0 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 35, top: TOPBAR_H }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      {showSidebar && (
        <aside
          className="fixed flex flex-col"
          style={{
            left: 0,
            top: isDesktop ? 0 : TOPBAR_H,
            bottom: 0,
            width: SIDEBAR_W,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            zIndex: 36,
          }}
        >
          {isDesktop && (
            <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <Brand />
            </div>
          )}

          <nav className="flex-1 px-3 py-4 space-y-0.5">
            <p className="px-3 mb-2 text-xs font-500" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Espacio de trabajo
            </p>
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={false}
                className={({ isActive }) => isActive
                  ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-500 transition-colors'
                  : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-400 transition-colors'
                }
                style={({ isActive }) => isActive
                  ? { background: 'var(--cyan-muted)', color: 'var(--cyan)', borderLeft: '2px solid var(--cyan)', paddingLeft: 10 }
                  : { color: 'var(--text2)' }
                }
              >
                {({ isActive }) => (
                  <>
                    <span style={{ opacity: isActive ? 1 : 0.7 }}>{icon}</span>
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--surface2)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0"
                style={{ background: 'var(--cyan-muted)', color: 'var(--cyan)' }}>
                {currentUser?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-500 truncate" style={{ color: 'var(--text1)' }}>{currentUser?.username}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>{currentUser?.role}</p>
              </div>
              <button
                onClick={() => { logout(); navigate('/login') }}
                title="Cerrar sesión"
                className="flex-shrink-0 transition-colors"
                style={{ color: 'var(--text3)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Content */}
      <main
        style={{
          marginLeft: isDesktop ? SIDEBAR_W : 0,
          paddingTop: isDesktop ? 0 : TOPBAR_H,
          minHeight: '100vh',
        }}
      >
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
        <Route path="/pair" element={<PairingScreen />} />
        <Route path="/playlists/:id/play" element={<PlaylistPlayer />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="/playlists" element={<Home />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/playlists/:id/edit" element={<PlaylistEditor />} />
          <Route path="/screens" element={<Screens />} />
          <Route path="/screens/:screenId/schedules" element={<ScreenSchedules />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
