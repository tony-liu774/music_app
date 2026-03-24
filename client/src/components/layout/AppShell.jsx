import { Outlet } from 'react-router-dom'
import MainNav from './MainNav'
import MobileNav from './MobileNav'
import { useUIStore } from '../../stores/useUIStore'
import { useOffline } from '../../hooks/useOffline'
import { useScoreCache } from '../../hooks/useScoreCache'
import { useToast } from '../ui/Toast'

export default function AppShell() {
  const navVisible = useUIStore((s) => s.navVisible)
  const toast = useToast()
  const { isOnline, pendingCount } = useOffline({ toast })

  // Cache scores to IndexedDB for offline access
  useScoreCache()

  return (
    <div className="min-h-screen bg-oxford-blue text-ivory">
      <div
        data-testid="nav-wrapper"
        className={`transition-opacity duration-500 ${
          navVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <MainNav isOnline={isOnline} pendingCount={pendingCount} />
      </div>
      <main className="px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto">
        <Outlet />
      </main>
      <div
        data-testid="mobile-nav-wrapper"
        className={`transition-opacity duration-500 ${
          navVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <MobileNav isOnline={isOnline} pendingCount={pendingCount} />
      </div>
    </div>
  )
}
