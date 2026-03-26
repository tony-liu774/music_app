import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BrowserCompatCheck, { checkBrowserCompat } from '../BrowserCompatCheck'

describe('checkBrowserCompat', () => {
  beforeEach(() => {
    // Provide all APIs by default
    window.AudioContext = vi.fn()
    window.Worker = vi.fn()
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    })
    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(), enumerateDevices: vi.fn() },
      writable: true,
      configurable: true,
    })
  })

  it('reports supported when all APIs available', () => {
    const result = checkBrowserCompat()
    expect(result.supported).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('detects missing AudioContext', () => {
    delete window.AudioContext
    delete window.webkitAudioContext
    const result = checkBrowserCompat()
    expect(result.supported).toBe(false)
    expect(result.issues).toContain('Web Audio API')
  })

  it('accepts webkitAudioContext as fallback', () => {
    delete window.AudioContext
    window.webkitAudioContext = vi.fn()
    const result = checkBrowserCompat()
    expect(result.issues).not.toContain('Web Audio API')
  })

  it('detects missing Web Workers', () => {
    delete window.Worker
    const result = checkBrowserCompat()
    expect(result.issues).toContain('Web Workers')
  })
})

describe('BrowserCompatCheck component', () => {
  beforeEach(() => {
    // Ensure all APIs exist so default render passes through
    window.AudioContext = vi.fn()
    window.Worker = vi.fn()
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(), enumerateDevices: vi.fn() },
      writable: true,
      configurable: true,
    })
  })

  it('renders children when browser is supported', () => {
    render(
      <BrowserCompatCheck>
        <div data-testid="child">Hello</div>
      </BrowserCompatCheck>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('shows warning when APIs are missing', () => {
    delete window.AudioContext
    delete window.webkitAudioContext
    render(
      <BrowserCompatCheck>
        <div data-testid="child">Hello</div>
      </BrowserCompatCheck>,
    )
    expect(screen.getByTestId('browser-compat-warning')).toBeInTheDocument()
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('lists missing features', () => {
    delete window.AudioContext
    delete window.webkitAudioContext
    render(
      <BrowserCompatCheck>
        <div>Hello</div>
      </BrowserCompatCheck>,
    )
    expect(screen.getByText('Web Audio API')).toBeInTheDocument()
  })

  it('can be dismissed to show children', () => {
    delete window.AudioContext
    delete window.webkitAudioContext
    render(
      <BrowserCompatCheck>
        <div data-testid="child">Hello</div>
      </BrowserCompatCheck>,
    )
    fireEvent.click(screen.getByTestId('compat-dismiss-button'))
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
