import { useUIStore } from '../../stores/useUIStore'

/* eslint-disable react/prop-types */

/**
 * PracticeView — purely visual immersive practice wrapper that manages the
 * distraction-free view transition. When ghost mode is active, all UI chrome
 * (menus, nav) fades to opacity-0 over 500ms via Zustand ghostMode → AppShell.
 *
 * Keyboard shortcuts (Escape, Space) are handled by PracticePage, not here.
 *
 * Props:
 * - children: ReactNode — the practice content (sheet music, cursor, needle)
 */
export default function PracticeView({ children }) {
  const ghostMode = useUIStore((s) => s.ghostMode)

  return (
    <div
      data-testid="practice-view"
      className={`relative transition-all duration-500 ${
        ghostMode ? 'fixed inset-0 z-40 bg-oxford-blue' : 'h-[calc(100vh-5rem)]'
      }`}
    >
      {children}
    </div>
  )
}
