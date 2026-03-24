import { Outlet } from 'react-router-dom'
import MainNav from './MainNav'
import MobileNav from './MobileNav'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-oxford-blue text-ivory">
      <MainNav />
      <main className="px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}
