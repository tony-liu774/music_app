import { NavLink } from 'react-router-dom'
import OfflineIndicator from './OfflineIndicator'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/library', label: 'Library' },
  { to: '/practice', label: 'Practice' },
  { to: '/tuner', label: 'Tuner' },
  { to: '/settings', label: 'Settings' },
]

export default function MainNav({ isOnline = true, pendingCount = 0 }) {
  return (
    <nav className="hidden md:flex items-center h-16 px-6 bg-surface border-b border-border">
      <NavLink to="/" className="flex items-center gap-2 mr-8">
        <svg
          className="max-w-8 max-h-8 w-8 h-8"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle
            cx="16"
            cy="16"
            r="14"
            stroke="currentColor"
            strokeWidth="2"
            className="text-amber"
          />
          <path
            d="M12 10v12l4-2v-8l-4-2z"
            fill="currentColor"
            className="text-amber"
          />
          <path
            d="M18 12v8l4-2v-4l-4-2z"
            fill="currentColor"
            className="text-amber-light"
          />
        </svg>
        <span className="font-heading text-lg text-ivory">Concertmaster</span>
      </NavLink>

      <div className="flex items-center gap-1">
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `px-3 py-2 font-body text-sm transition-colors duration-150 border-b-2 ${
                isActive
                  ? 'text-amber border-amber'
                  : 'text-ivory-muted border-transparent hover:text-ivory hover:border-border-light'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div className="ml-auto">
        <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
      </div>
    </nav>
  )
}
