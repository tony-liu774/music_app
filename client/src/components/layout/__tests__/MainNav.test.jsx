import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MainNav from '../MainNav'

function renderNav(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MainNav />
    </MemoryRouter>
  )
}

describe('MainNav', () => {
  it('renders the logo text', () => {
    renderNav()
    expect(screen.getByText('Concertmaster')).toBeInTheDocument()
  })

  it('renders all nav links', () => {
    renderNav()
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /practice/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /tuner/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('highlights active link with amber classes', () => {
    renderNav(['/library'])
    const libraryLink = screen.getByRole('link', { name: /library/i })
    expect(libraryLink.className).toContain('text-amber')
    expect(libraryLink.className).toContain('border-amber')
  })

  it('does not highlight inactive links with amber', () => {
    renderNav(['/library'])
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink.className).not.toContain('text-amber')
  })

  it('logo SVG has bounded dimensions', () => {
    renderNav()
    const svg = document.querySelector('nav svg')
    expect(svg).toHaveClass('max-w-8', 'max-h-8')
  })

  it('is hidden on mobile (has hidden md:flex)', () => {
    renderNav()
    const nav = document.querySelector('nav')
    expect(nav.className).toContain('hidden')
    expect(nav.className).toContain('md:flex')
  })
})
