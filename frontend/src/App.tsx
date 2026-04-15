import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import MediaLibrary from './pages/MediaLibrary'
import PlaylistEditor from './pages/PlaylistEditor'
import PlaylistPlayer from './pages/PlaylistPlayer'
import Login from './pages/Login'
import { isAuthenticated, onAuthChange } from './auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [authed, setAuthed] = useState(isAuthenticated())

  useEffect(() => onAuthChange(() => setAuthed(isAuthenticated())), [])

  if (!authed) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* PlaylistPlayer is public — screens authenticate with their own screen token */}
        <Route path="/playlists/:id/play" element={<PlaylistPlayer />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/media"
          element={
            <RequireAuth>
              <MediaLibrary />
            </RequireAuth>
          }
        />
        <Route
          path="/playlists/:id/edit"
          element={
            <RequireAuth>
              <PlaylistEditor />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
