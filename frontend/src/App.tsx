import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import MediaLibrary from './pages/MediaLibrary'
import PlaylistEditor from './pages/PlaylistEditor'
import PlaylistPlayer from './pages/PlaylistPlayer'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/media" element={<MediaLibrary />} />
        <Route path="/playlists/:id/edit" element={<PlaylistEditor />} />
        <Route path="/playlists/:id/play" element={<PlaylistPlayer />} />
      </Routes>
    </BrowserRouter>
  )
}
