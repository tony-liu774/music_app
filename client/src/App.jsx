import { HashRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import BrowserCompatCheck from './components/layout/BrowserCompatCheck'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import PracticePage from './pages/PracticePage'
import Tuner from './pages/Tuner'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserCompatCheck>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="library" element={<Library />} />
              <Route path="practice" element={<PracticePage />} />
              <Route path="tuner" element={<Tuner />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </BrowserCompatCheck>
  )
}

export default App
