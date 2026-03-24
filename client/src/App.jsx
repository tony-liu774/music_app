import { HashRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import PracticePage from './pages/PracticePage'
import Tuner from './pages/Tuner'
import Settings from './pages/Settings'
import StudioDashboard from './pages/StudioDashboard'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="library" element={<Library />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="tuner" element={<Tuner />} />
          <Route path="settings" element={<Settings />} />
          <Route path="studio-dashboard" element={<StudioDashboard />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
