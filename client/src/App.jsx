import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AuthSyncProvider } from './contexts/AuthSyncProvider'
import AppShell from './components/layout/AppShell'
import LoginPage from './components/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import PracticePage from './pages/PracticePage'
import Tuner from './pages/Tuner'
import Settings from './pages/Settings'
import StudioDashboard from './pages/StudioDashboard'

function App() {
  return (
    <AuthProvider>
      <AuthSyncProvider>
        <HashRouter>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="library" element={<Library />} />
              <Route path="practice" element={<PracticePage />} />
              <Route path="tuner" element={<Tuner />} />
              <Route path="settings" element={<Settings />} />
              <Route path="studio-dashboard" element={<StudioDashboard />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthSyncProvider>
    </AuthProvider>
  )
}

export default App
