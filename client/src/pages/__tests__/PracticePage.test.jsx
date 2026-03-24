import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PracticePage from '../PracticePage'
import { useUIStore } from '../../stores/useUIStore'
import { useAudioStore } from '../../stores/useAudioStore'

function renderPracticePage() {
  return render(
    <MemoryRouter>
      <PracticePage />
    </MemoryRouter>,
  )
}

describe('PracticePage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUIStore.setState({
      currentView: 'home',
      modalOpen: false,
      modalContent: null,
      toasts: [],
      sidebarOpen: true,
      theme: 'midnight',
      navVisible: true,
      ghostMode: false,
    })
    useAudioStore.setState({
      isPracticing: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the practice page', () => {
    renderPracticePage()
    expect(screen.getByTestId('practice-page')).toBeInTheDocument()
    expect(screen.getByTestId('sheet-music-area')).toBeInTheDocument()
    expect(screen.getByTestId('practice-controls')).toBeInTheDocument()
  })

  it('shows title and instructions when not practicing', () => {
    renderPracticePage()
    expect(screen.getByText('Practice')).toBeInTheDocument()
    expect(
      screen.getByText('Press play to start your practice session'),
    ).toBeInTheDocument()
  })

  it('enters ghost mode when play is clicked', () => {
    renderPracticePage()
    fireEvent.click(screen.getByTestId('play-pause-button'))

    expect(useAudioStore.getState().isPracticing).toBe(true)
    expect(useUIStore.getState().ghostMode).toBe(true)
    expect(useUIStore.getState().navVisible).toBe(false)
  })

  it('exits ghost mode when stop is clicked', () => {
    renderPracticePage()
    // Start practicing
    fireEvent.click(screen.getByTestId('play-pause-button'))
    expect(useUIStore.getState().ghostMode).toBe(true)

    // Stop
    fireEvent.click(screen.getByTestId('stop-button'))
    expect(useAudioStore.getState().isPracticing).toBe(false)
    expect(useUIStore.getState().ghostMode).toBe(false)
    expect(useUIStore.getState().navVisible).toBe(true)
  })

  it('exits ghost mode on pause so nav reappears', () => {
    renderPracticePage()
    // Start
    fireEvent.click(screen.getByTestId('play-pause-button'))
    expect(useAudioStore.getState().isPracticing).toBe(true)
    expect(useUIStore.getState().ghostMode).toBe(true)
    expect(useUIStore.getState().navVisible).toBe(false)

    // Pause — ghost mode exits, nav comes back
    fireEvent.click(screen.getByTestId('play-pause-button'))
    expect(useAudioStore.getState().isPracticing).toBe(false)
    expect(useUIStore.getState().ghostMode).toBe(false)
    expect(useUIStore.getState().navVisible).toBe(true)
  })

  it('re-enters ghost mode on resume after pause', () => {
    renderPracticePage()
    // Start
    fireEvent.click(screen.getByTestId('play-pause-button'))
    // Pause
    fireEvent.click(screen.getByTestId('play-pause-button'))
    expect(useUIStore.getState().ghostMode).toBe(false)

    // Resume
    fireEvent.click(screen.getByTestId('play-pause-button'))
    expect(useAudioStore.getState().isPracticing).toBe(true)
    expect(useUIStore.getState().ghostMode).toBe(true)
    expect(useUIStore.getState().navVisible).toBe(false)
  })

  it('Space key toggles play/pause', () => {
    renderPracticePage()

    // Space to play
    fireEvent.keyDown(window, { code: 'Space' })
    expect(useAudioStore.getState().isPracticing).toBe(true)

    // Space to pause
    fireEvent.keyDown(window, { code: 'Space' })
    expect(useAudioStore.getState().isPracticing).toBe(false)
  })

  it('Escape key stops practice and exits ghost mode', () => {
    renderPracticePage()

    // Start practicing
    fireEvent.keyDown(window, { code: 'Space' })
    expect(useAudioStore.getState().isPracticing).toBe(true)
    expect(useUIStore.getState().ghostMode).toBe(true)

    // Escape to stop
    fireEvent.keyDown(window, { code: 'Escape' })
    expect(useAudioStore.getState().isPracticing).toBe(false)
    expect(useUIStore.getState().ghostMode).toBe(false)
    expect(useUIStore.getState().navVisible).toBe(true)
  })

  it('auto-hides controls after 3 seconds during practice', () => {
    renderPracticePage()

    // Start practicing
    fireEvent.click(screen.getByTestId('play-pause-button'))

    // Controls visible initially
    const controls = screen.getByTestId('practice-controls')
    expect(controls.className).toContain('opacity-100')

    // Fast-forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(controls.className).toContain('opacity-0')
  })

  it('shows controls on mouse movement during ghost mode', () => {
    renderPracticePage()

    // Start practicing
    fireEvent.click(screen.getByTestId('play-pause-button'))

    // Wait for controls to auto-hide
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    const controls = screen.getByTestId('practice-controls')
    expect(controls.className).toContain('opacity-0')

    // Move mouse
    fireEvent.mouseMove(window)

    expect(controls.className).toContain('opacity-100')
  })

  it('shows tap overlay when controls are hidden in ghost mode', () => {
    renderPracticePage()

    // Start practicing
    fireEvent.click(screen.getByTestId('play-pause-button'))

    // Wait for controls to auto-hide
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByTestId('tap-overlay')).toBeInTheDocument()
  })

  it('does not trigger shortcuts when typing in an input', () => {
    renderPracticePage()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { code: 'Space' })
    expect(useAudioStore.getState().isPracticing).toBe(false)

    document.body.removeChild(input)
  })

  it('cleans up ghost mode on unmount', () => {
    const { unmount } = renderPracticePage()

    // Start practicing
    fireEvent.click(screen.getByTestId('play-pause-button'))
    expect(useUIStore.getState().ghostMode).toBe(true)

    // Unmount
    unmount()

    expect(useUIStore.getState().ghostMode).toBe(false)
    expect(useAudioStore.getState().isPracticing).toBe(false)
  })

  it('takes full viewport in ghost mode', () => {
    renderPracticePage()

    fireEvent.click(screen.getByTestId('play-pause-button'))

    const page = screen.getByTestId('practice-page')
    expect(page.className).toContain('fixed')
    expect(page.className).toContain('inset-0')
  })

  it('has relative positioning when not in ghost mode', () => {
    renderPracticePage()
    const page = screen.getByTestId('practice-page')
    expect(page.className).toContain('relative')
    expect(page.className).not.toContain('fixed')
  })
})
