import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TunerPage from '../TunerPage'
import { useAudioStore } from '../../stores/useAudioStore'
import { useSettingsStore } from '../../stores/useSettingsStore'

// Mock the hooks
vi.mock('../../hooks/useAudioPipeline', () => ({
  useAudioPipeline: () => ({
    start: vi.fn(),
    stop: mockStop,
    isRunning: mockIsRunning,
    error: mockError,
  }),
}))

vi.mock('../../hooks/useMicrophone', () => ({
  useMicrophone: () => ({
    requestAccess: mockRequestAccess,
    stopStream: vi.fn(),
    status: mockMicStatus,
  }),
}))

let mockIsRunning = false
let mockError = null
let mockMicStatus = 'idle'
let mockStop = vi.fn()
let mockRequestAccess = vi.fn()

describe('TunerPage', () => {
  beforeEach(() => {
    mockIsRunning = false
    mockError = null
    mockMicStatus = 'idle'
    mockStop = vi.fn()
    mockRequestAccess = vi.fn().mockResolvedValue(null)
    useAudioStore.setState({
      pitchData: { frequency: null, note: null, cents: null, confidence: 0 },
    })
    useSettingsStore.setState({ instrument: 'violin', needleSensitivity: 0.5 })
  })

  it('renders the tuner page', () => {
    render(<TunerPage />)
    expect(screen.getByTestId('tuner-page')).toBeInTheDocument()
  })

  it('displays the page title', () => {
    render(<TunerPage />)
    expect(screen.getByText('Precision Tuner')).toBeInTheDocument()
  })

  it('renders the tuner gauge', () => {
    render(<TunerPage />)
    expect(screen.getByTestId('tuner-gauge')).toBeInTheDocument()
  })

  it('renders the tuner display', () => {
    render(<TunerPage />)
    expect(screen.getByTestId('tuner-display')).toBeInTheDocument()
  })

  it('shows Start Tuner button when not running', () => {
    render(<TunerPage />)
    expect(screen.getByText('Start Tuner')).toBeInTheDocument()
  })

  it('shows Stop Tuner button when running', () => {
    mockIsRunning = true
    render(<TunerPage />)
    expect(screen.getByText('Stop Tuner')).toBeInTheDocument()
  })

  it('shows status indicator', () => {
    render(<TunerPage />)
    expect(screen.getByTestId('tuner-status')).toBeInTheDocument()
    expect(screen.getByText('Tap Start to begin')).toBeInTheDocument()
  })

  it('shows Listening status when running', () => {
    mockIsRunning = true
    render(<TunerPage />)
    expect(screen.getByText('Listening...')).toBeInTheDocument()
  })

  it('shows error when microphone is denied', () => {
    mockMicStatus = 'denied'
    render(<TunerPage />)
    expect(screen.getByTestId('tuner-error')).toBeInTheDocument()
    expect(screen.getByText(/Microphone access was denied/)).toBeInTheDocument()
  })

  it('shows error when pipeline has an error', () => {
    mockError = new Error('Worker failed')
    render(<TunerPage />)
    expect(screen.getByTestId('tuner-error')).toBeInTheDocument()
    expect(screen.getByText('Worker failed')).toBeInTheDocument()
  })

  it('renders open string references for selected instrument', () => {
    render(<TunerPage />)
    expect(screen.getByTestId('open-strings')).toBeInTheDocument()
    expect(screen.getByText('G3')).toBeInTheDocument()
    expect(screen.getByText('E5')).toBeInTheDocument()
  })

  it('shows subtitle text', () => {
    render(<TunerPage />)
    expect(
      screen.getByText(/Fine-tune your instrument/),
    ).toBeInTheDocument()
  })

  it('renders SVG icons with max-w and max-h classes', () => {
    render(<TunerPage />)
    const svgs = screen.getByTestId('tuner-page').querySelectorAll('svg[aria-hidden]')
    svgs.forEach((svg) => {
      expect(svg.classList.toString()).toContain('max-w')
      expect(svg.classList.toString()).toContain('max-h')
    })
  })

  it('requests microphone access when start is clicked', async () => {
    const user = userEvent.setup()
    render(<TunerPage />)
    await user.click(screen.getByText('Start Tuner'))
    expect(mockRequestAccess).toHaveBeenCalled()
  })

  it('calls stop when stop button is clicked', async () => {
    mockIsRunning = true
    const user = userEvent.setup()
    render(<TunerPage />)
    await user.click(screen.getByText('Stop Tuner'))
    expect(mockStop).toHaveBeenCalled()
  })
})
