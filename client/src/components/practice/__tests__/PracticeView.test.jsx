import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PracticeView from '../PracticeView'
import { useUIStore } from '../../../stores/useUIStore'

describe('PracticeView', () => {
  beforeEach(() => {
    useUIStore.setState({
      ghostMode: false,
      navVisible: true,
    })
  })

  it('renders children', () => {
    render(
      <PracticeView isPlaying={false} onRequestStop={vi.fn()}>
        <div data-testid="child">Hello</div>
      </PracticeView>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders with practice-view test id', () => {
    render(
      <PracticeView isPlaying={false} onRequestStop={vi.fn()}>
        <div>Content</div>
      </PracticeView>,
    )
    expect(screen.getByTestId('practice-view')).toBeInTheDocument()
  })

  it('has relative positioning when not in ghost mode', () => {
    render(
      <PracticeView isPlaying={false} onRequestStop={vi.fn()}>
        <div>Content</div>
      </PracticeView>,
    )
    const view = screen.getByTestId('practice-view')
    expect(view.className).toContain('relative')
    expect(view.className).not.toContain('fixed')
  })

  it('takes full viewport in ghost mode', () => {
    useUIStore.setState({ ghostMode: true })
    render(
      <PracticeView isPlaying={true} onRequestStop={vi.fn()}>
        <div>Content</div>
      </PracticeView>,
    )
    const view = screen.getByTestId('practice-view')
    expect(view.className).toContain('fixed')
    expect(view.className).toContain('inset-0')
    expect(view.className).toContain('z-40')
  })

  it('has 500ms transition for smooth fade', () => {
    render(
      <PracticeView isPlaying={false} onRequestStop={vi.fn()}>
        <div>Content</div>
      </PracticeView>,
    )
    const view = screen.getByTestId('practice-view')
    expect(view.className).toContain('duration-500')
    expect(view.className).toContain('transition-all')
  })

  it('calls onRequestStop when Escape is pressed during play', () => {
    const onRequestStop = vi.fn()
    render(
      <PracticeView isPlaying={true} onRequestStop={onRequestStop}>
        <div>Content</div>
      </PracticeView>,
    )

    fireEvent.keyDown(window, { code: 'Escape' })
    expect(onRequestStop).toHaveBeenCalledTimes(1)
  })

  it('does not call onRequestStop on Escape when not playing', () => {
    const onRequestStop = vi.fn()
    render(
      <PracticeView isPlaying={false} onRequestStop={onRequestStop}>
        <div>Content</div>
      </PracticeView>,
    )

    fireEvent.keyDown(window, { code: 'Escape' })
    expect(onRequestStop).not.toHaveBeenCalled()
  })

  it('cleans up keydown listener on unmount', () => {
    const onRequestStop = vi.fn()
    const { unmount } = render(
      <PracticeView isPlaying={true} onRequestStop={onRequestStop}>
        <div>Content</div>
      </PracticeView>,
    )

    unmount()
    fireEvent.keyDown(window, { code: 'Escape' })
    expect(onRequestStop).not.toHaveBeenCalled()
  })
})
