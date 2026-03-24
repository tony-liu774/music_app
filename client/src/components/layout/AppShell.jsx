import { Outlet } from 'react-router-dom'
import MainNav from './MainNav'
import MobileNav from './MobileNav'
import { useUIStore } from '../../stores/useUIStore'

export default function AppShell() {
  const navVisible = useUIStore((s) => s.navVisible)

  return (
    <div className="min-h-screen bg-oxford-blue text-ivory">
      <div
        data-testid="nav-wrapper"
        className={`transition-opacity duration-500 ${
          navVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <MainNav />
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
        <MobileNav />
      </div>
    </div>
  )
}
