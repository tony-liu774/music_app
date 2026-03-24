import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('The Virtual Concertmaster')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<App />)
    expect(
      screen.getByText('AI-Powered Practice Companion for String Players'),
    ).toBeInTheDocument()
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
