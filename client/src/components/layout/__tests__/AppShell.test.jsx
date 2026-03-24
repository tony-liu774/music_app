import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from '../AppShell'

function renderShell(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>Dashboard Page</div>} />
          <Route path="library" element={<div>Library Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('renders child route content via Outlet', () => {
    renderShell()
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('renders the correct child for a different route', () => {
    renderShell(['/library'])
    expect(screen.getByText('Library Page')).toBeInTheDocument()
  })

  it('renders both MainNav and MobileNav', () => {
    renderShell()
    const navs = document.querySelectorAll('nav')
    expect(navs).toHaveLength(2)
  })

  it('has proper background and text classes', () => {
    renderShell()
    const shell = document.querySelector('.min-h-screen')
    expect(shell).toHaveClass('bg-oxford-blue', 'text-ivory')
  })

  it('main content area has padding', () => {
    renderShell()
    const main = document.querySelector('main')
    expect(main.className).toContain('px-4')
    expect(main.className).toContain('py-6')
  })
})
