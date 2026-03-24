import { useEffect } from 'react'
import { useAuth } from './AuthContext'
import { useAuthStore } from '../stores/useAuthStore'

export function AuthSyncProvider({ children }) {
  const { user, session, loading } = useAuth()
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    if (loading) {
      setLoading(true)
      return
    }
    if (user && session) {
      setAuth(user, session)
    } else {
      clearAuth()
    }
  }, [user, session, loading, setAuth, clearAuth, setLoading])

  return children
}
