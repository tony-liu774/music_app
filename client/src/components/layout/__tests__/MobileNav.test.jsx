import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MobileNav from '../MobileNav'

function renderNav(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MobileNav />
    </MemoryRouter>
  )
}

describe('MobileNav', () => {
  it('renders all tab labels', () => {
    renderNav()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Library')).toBeInTheDocument()
    expect(screen.getByText('Practice')).toBeInTheDocument()
    expect(screen.getByText('Tuner')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights the active tab with amber', () => {
    renderNav(['/practice'])
    const practiceLink = screen.getByRole('link', { name: /practice/i })
    expect(practiceLink.className).toContain('text-amber')
  })

  it('does not highlight inactive tabs', () => {
    renderNav(['/practice'])
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink.className).not.toContain('text-amber')
  })

  it('is visible only on mobile (has md:hidden)', () => {
    renderNav()
    const nav = document.querySelector('nav')
    expect(nav.className).toContain('md:hidden')
  })

  it('SVG icons have bounded dimensions', () => {
    renderNav()
    const svgs = document.querySelectorAll('nav svg')
    svgs.forEach(svg => {
      expect(svg).toHaveClass('max-w-6', 'max-h-6')
    })
  })

  it('is fixed to the bottom', () => {
    renderNav()
    const nav = document.querySelector('nav')
    expect(nav.className).toContain('fixed')
    expect(nav.className).toContain('bottom-0')
  })
})
