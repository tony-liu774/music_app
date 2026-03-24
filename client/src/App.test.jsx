import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '#/'
  })

  it('applies Midnight Conservatory background class', () => {
    const { container } = render(<App />)
    const root = container.firstChild
    expect(root).toHaveClass('bg-oxford-blue')
  })

  it('applies ivory text class', () => {
    const { container } = render(<App />)
    const root = container.firstChild
    expect(root).toHaveClass('text-ivory')
  })
})

describe('App routing', () => {
  beforeEach(() => {
    window.location.hash = '#/'
  })

  it('renders Dashboard on the root route', () => {
    render(<App />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('navigates to Library when clicking Library link', async () => {
    const user = userEvent.setup()
    render(<App />)
    const libraryLinks = screen.getAllByRole('link', { name: /library/i })
    await user.click(libraryLinks[0])
    expect(screen.getByText(/music library/i)).toBeInTheDocument()
  })

  it('navigates to Practice page', async () => {
    const user = userEvent.setup()
    render(<App />)
    const practiceLinks = screen.getAllByRole('link', { name: /practice/i })
    await user.click(practiceLinks[0])
    expect(screen.getByText(/guided practice/i)).toBeInTheDocument()
  })

  it('navigates to Tuner page', async () => {
    const user = userEvent.setup()
    render(<App />)
    const tunerLinks = screen.getAllByRole('link', { name: /tuner/i })
    await user.click(tunerLinks[0])
    expect(screen.getByText(/pitch detection/i)).toBeInTheDocument()
  })

  it('navigates to Settings page', async () => {
    const user = userEvent.setup()
    render(<App />)
    const settingsLinks = screen.getAllByRole('link', { name: /settings/i })
    await user.click(settingsLinks[0])
    expect(screen.getByText(/preferences/i)).toBeInTheDocument()
  })

  it('renders Studio Dashboard via direct hash', () => {
    window.location.hash = '#/studio-dashboard'
    render(<App />)
    expect(screen.getByText('Studio Dashboard')).toBeInTheDocument()
  })

  it('uses HashRouter (URL contains #)', async () => {
    const user = userEvent.setup()
    render(<App />)
    const libraryLinks = screen.getAllByRole('link', { name: /library/i })
    await user.click(libraryLinks[0])
    expect(window.location.hash).toContain('library')
  })

  it('highlights active nav link after navigation', async () => {
    const user = userEvent.setup()
    render(<App />)
    const libraryLinks = screen.getAllByRole('link', { name: /library/i })
    await user.click(libraryLinks[0])
    libraryLinks.forEach(link => {
      expect(link.className).toContain('text-amber')
    })
  })
})
