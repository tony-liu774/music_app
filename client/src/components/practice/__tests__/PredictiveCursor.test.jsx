import { describe, it, expect } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import PredictiveCursor from '../PredictiveCursor'

describe('PredictiveCursor', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <PredictiveCursor visible={false} isBouncing={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders cursor elements when visible', () => {
    render(<PredictiveCursor visible={true} isBouncing={false} />)
    expect(screen.getByTestId('predictive-cursor')).toBeInTheDocument()
    expect(screen.getByTestId('cursor-ball')).toBeInTheDocument()
    expect(screen.getByTestId('cursor-glow')).toBeInTheDocument()
  })

  it('forwards ref to the root element for direct DOM updates', () => {
    const ref = createRef()
    render(<PredictiveCursor ref={ref} visible={true} isBouncing={false} />)
    expect(ref.current).toBe(screen.getByTestId('predictive-cursor'))
  })

  it('allows position to be set via ref style', () => {
    const ref = createRef()
    render(<PredictiveCursor ref={ref} visible={true} isBouncing={false} />)
    ref.current.style.left = '200px'
    ref.current.style.top = '80px'
    expect(ref.current.style.left).toBe('200px')
    expect(ref.current.style.top).toBe('80px')
  })

  it('applies pulse animation classes when not bouncing', () => {
    render(<PredictiveCursor visible={true} isBouncing={false} />)
    const ball = screen.getByTestId('cursor-ball')
    const glow = screen.getByTestId('cursor-glow')
    expect(ball.className).toContain('animate-ball-pulse')
    expect(glow.className).toContain('animate-glow-pulse')
  })

  it('applies bounce animation classes when bouncing', () => {
    render(<PredictiveCursor visible={true} isBouncing={true} />)
    const ball = screen.getByTestId('cursor-ball')
    const glow = screen.getByTestId('cursor-glow')
    expect(ball.className).toContain('animate-ball-bounce')
    expect(glow.className).toContain('animate-glow-bounce')
  })

  it('has pointer-events-none so it does not block interaction', () => {
    render(<PredictiveCursor visible={true} isBouncing={false} />)
    const cursor = screen.getByTestId('predictive-cursor')
    expect(cursor.className).toContain('pointer-events-none')
  })

  it('centers the cursor using translate(-50%, -50%)', () => {
    render(<PredictiveCursor visible={true} isBouncing={false} />)
    const cursor = screen.getByTestId('predictive-cursor')
    expect(cursor.style.transform).toBe('translate(-50%, -50%)')
  })

  it('applies amber glow shadow class to ball', () => {
    render(<PredictiveCursor visible={true} isBouncing={false} />)
    const ball = screen.getByTestId('cursor-ball')
    expect(ball.className).toContain('shadow-amber-glow')
  })
})
