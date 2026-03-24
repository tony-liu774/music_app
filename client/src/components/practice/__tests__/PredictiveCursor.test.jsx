import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PredictiveCursor from '../PredictiveCursor'

describe('PredictiveCursor', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <PredictiveCursor x={100} y={50} visible={false} isBouncing={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders cursor elements when visible', () => {
    render(
      <PredictiveCursor x={100} y={50} visible={true} isBouncing={false} />,
    )
    expect(screen.getByTestId('predictive-cursor')).toBeInTheDocument()
    expect(screen.getByTestId('cursor-ball')).toBeInTheDocument()
    expect(screen.getByTestId('cursor-glow')).toBeInTheDocument()
  })

  it('positions cursor at the given x,y coordinates', () => {
    render(
      <PredictiveCursor x={200} y={80} visible={true} isBouncing={false} />,
    )
    const cursor = screen.getByTestId('predictive-cursor')
    expect(cursor.style.left).toBe('200px')
    expect(cursor.style.top).toBe('80px')
  })

  it('applies pulse animation classes when not bouncing', () => {
    render(<PredictiveCursor x={0} y={0} visible={true} isBouncing={false} />)
    const ball = screen.getByTestId('cursor-ball')
    const glow = screen.getByTestId('cursor-glow')
    expect(ball.className).toContain('animate-ball-pulse')
    expect(glow.className).toContain('animate-glow-pulse')
  })

  it('applies bounce animation classes when bouncing', () => {
    render(<PredictiveCursor x={0} y={0} visible={true} isBouncing={true} />)
    const ball = screen.getByTestId('cursor-ball')
    const glow = screen.getByTestId('cursor-glow')
    expect(ball.className).toContain('animate-ball-bounce')
    expect(glow.className).toContain('animate-glow-bounce')
  })

  it('has pointer-events-none so it does not block interaction', () => {
    render(<PredictiveCursor x={0} y={0} visible={true} isBouncing={false} />)
    const cursor = screen.getByTestId('predictive-cursor')
    expect(cursor.className).toContain('pointer-events-none')
  })

  it('centers the cursor using translate(-50%, -50%)', () => {
    render(<PredictiveCursor x={50} y={50} visible={true} isBouncing={false} />)
    const cursor = screen.getByTestId('predictive-cursor')
    expect(cursor.style.transform).toBe('translate(-50%, -50%)')
  })

  it('applies amber glow shadow class to ball', () => {
    render(<PredictiveCursor x={0} y={0} visible={true} isBouncing={false} />)
    const ball = screen.getByTestId('cursor-ball')
    expect(ball.className).toContain('shadow-amber-glow')
  })
})
