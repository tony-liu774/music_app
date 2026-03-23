import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToastProvider, useToast } from '../Toast'

function TestConsumer() {
  const { addToast } = useToast()
  return (
    <div>
      <button onClick={() => addToast({ variant: 'success', message: 'Success toast' })}>
        Add Success
      </button>
      <button onClick={() => addToast({ variant: 'error', message: 'Error toast' })}>
        Add Error
      </button>
      <button onClick={() => addToast({ variant: 'info', message: 'Info toast' })}>
        Add Info
      </button>
    </div>
  )
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders toast when added via context', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Success'))
    expect(screen.getByText('Success toast')).toBeInTheDocument()
  })

  it('renders success variant with emerald border', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Success'))
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('border-emerald')
  })

  it('renders error variant with crimson border', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Error'))
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('border-crimson')
  })

  it('renders info variant with amber border', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Info'))
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('border-amber')
  })

  it('auto-dismisses after duration', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Success'))
    expect(screen.getByText('Success toast')).toBeInTheDocument()

    // Advance past default duration (4000ms) + exit animation (200ms)
    act(() => vi.advanceTimersByTime(4500))

    expect(screen.queryByText('Success toast')).not.toBeInTheDocument()
  })

  it('can be dismissed manually', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Success'))
    expect(screen.getByText('Success toast')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Dismiss notification'))
    act(() => vi.advanceTimersByTime(300))
    expect(screen.queryByText('Success toast')).not.toBeInTheDocument()
  })

  it('SVG icons have bounded dimensions', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Info'))
    const svgs = screen.getByRole('alert').querySelectorAll('svg')
    svgs.forEach((svg) => {
      expect(svg.className.baseVal).toMatch(/max-w-/)
      expect(svg.className.baseVal).toMatch(/max-h-/)
    })
  })

  it('contains no hardcoded hex codes', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Add Success'))
    const alert = screen.getByRole('alert')
    expect(alert.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('throws when useToast is used outside provider', () => {
    function BadComponent() {
      useToast()
      return null
    }
    expect(() => render(<BadComponent />)).toThrow(
      'useToast must be used within a ToastProvider',
    )
  })
})
