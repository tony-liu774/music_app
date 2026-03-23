import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Card from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies Midnight Conservatory theme classes', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('bg-surface')
    expect(card.className).toContain('rounded-lg')
    expect(card.className).toContain('border-border')
  })

  it('has hover glow effect', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('hover:shadow-amber-glow')
  })

  it('merges custom className', () => {
    render(<Card data-testid="card" className="my-class">Content</Card>)
    expect(screen.getByTestId('card').className).toContain('my-class')
  })

  it('contains no hardcoded hex codes', () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId('card').className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('passes through extra props', () => {
    render(<Card data-testid="card" id="my-card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveAttribute('id', 'my-card')
  })
})
