import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
      <PracticeView>
        <div data-testid="child">Hello</div>
      </PracticeView>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders with practice-view test id', () => {
    render(
      <PracticeView>
        <div>Content</div>
      </PracticeView>,
    )
    expect(screen.getByTestId('practice-view')).toBeInTheDocument()
  })

  it('has relative positioning when not in ghost mode', () => {
    render(
      <PracticeView>
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
      <PracticeView>
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
      <PracticeView>
        <div>Content</div>
      </PracticeView>,
    )
    const view = screen.getByTestId('practice-view')
    expect(view.className).toContain('duration-500')
    expect(view.className).toContain('transition-all')
  })

  it('is a purely visual wrapper with no keyboard handlers', () => {
    // PracticeView should not register any keydown listeners —
    // keyboard shortcuts are handled by PracticePage
    const addSpy = vi.spyOn(window, 'addEventListener')
    render(
      <PracticeView>
        <div>Content</div>
      </PracticeView>,
    )
    const keydownCalls = addSpy.mock.calls.filter(
      ([event]) => event === 'keydown',
    )
    expect(keydownCalls).toHaveLength(0)
    addSpy.mockRestore()
  })
})
