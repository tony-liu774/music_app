import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MicrophoneSetup from '../MicrophoneSetup'
import { useAudioStore } from '../../../stores/useAudioStore'

// Mock useMicrophone hook
const mockRequestAccess = vi.fn()
const mockStopStream = vi.fn()
const mockReset = vi.fn()

let mockStatus = 'idle'
let mockError = null

vi.mock('../../../hooks/useMicrophone', () => ({
  useMicrophone: () => ({
    status: mockStatus,
    error: mockError,
    requestAccess: mockRequestAccess,
    stopStream: mockStopStream,
    reset: mockReset,
    isSupported: mockStatus !== 'unsupported',
    isSecure: true,
    isActive: mockStatus === 'granted',
  }),
}))

// Mock InputLevelMeter to avoid AudioContext issues
vi.mock('../InputLevelMeter', () => ({
  default: ({ stream, active }) => (
    <div data-testid="level-meter" data-active={active ? 'true' : 'false'}>
      Level Meter
    </div>
  ),
}))

describe('MicrophoneSetup', () => {
  beforeEach(() => {
    mockStatus = 'idle'
    mockError = null
    mockRequestAccess.mockReset()
    mockStopStream.mockReset()
    mockReset.mockReset()
    useAudioStore.setState({ micPermission: 'prompt' })
  })

  it('renders initial permission request screen', () => {
    render(<MicrophoneSetup />)
    expect(screen.getByText("Let's Tune In")).toBeInTheDocument()
    expect(screen.getByText('Allow Microphone')).toBeInTheDocument()
  })

  it('shows privacy message about local processing', () => {
    render(<MicrophoneSetup />)
    expect(
      screen.getByText(/processed locally and never recorded/),
    ).toBeInTheDocument()
  })

  it('calls requestAccess when Allow Microphone is clicked', async () => {
    mockRequestAccess.mockResolvedValue(null)
    render(<MicrophoneSetup />)
    fireEvent.click(screen.getByText('Allow Microphone'))
    expect(mockRequestAccess).toHaveBeenCalled()
  })

  it('shows "Waiting for Permission..." when prompting', () => {
    mockStatus = 'prompting'
    render(<MicrophoneSetup />)
    expect(
      screen.getByText('Waiting for Permission...'),
    ).toBeInTheDocument()
  })

  it('shows denied screen with re-enable instructions', () => {
    mockStatus = 'denied'
    render(<MicrophoneSetup />)
    expect(screen.getByText('Microphone Access Denied')).toBeInTheDocument()
    expect(
      screen.getByText(/re-enable your microphone/),
    ).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('calls reset when Try Again is clicked on denied screen', () => {
    mockStatus = 'denied'
    render(<MicrophoneSetup />)
    fireEvent.click(screen.getByText('Try Again'))
    expect(mockReset).toHaveBeenCalled()
  })

  it('shows unsupported browser screen', () => {
    mockStatus = 'unsupported'
    render(<MicrophoneSetup />)
    expect(screen.getByText('Browser Not Supported')).toBeInTheDocument()
  })

  it('shows error screen for generic errors', () => {
    mockStatus = 'error'
    mockError = new Error('Something failed')
    render(<MicrophoneSetup />)
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
  })

  it('shows HTTPS-specific error message', () => {
    mockStatus = 'error'
    mockError = new Error('Microphone access requires HTTPS')
    render(<MicrophoneSetup />)
    expect(
      screen.getByText(/secure \(HTTPS\) connection/),
    ).toBeInTheDocument()
  })

  it('shows granted screen with level meter when stream is active', async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] }
    // When requestAccess is called, the component stores the stream internally
    // and the mock status needs to reflect 'granted' on re-render
    mockRequestAccess.mockImplementation(async () => {
      mockStatus = 'granted'
      return fakeStream
    })

    const { rerender } = render(<MicrophoneSetup />)
    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      // The component should show the granted screen with level meter
      // because it has both status='granted' and an active stream reference
      expect(screen.getByText('Microphone Connected')).toBeInTheDocument()
    })

    expect(screen.getByTestId('level-meter')).toBeInTheDocument()
    expect(
      screen.getByText('Sounds Good — Start Practicing'),
    ).toBeInTheDocument()
  })

  it('calls onComplete when continue button is clicked', async () => {
    const onComplete = vi.fn()
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] }
    mockRequestAccess.mockImplementation(async () => {
      mockStatus = 'granted'
      return fakeStream
    })

    render(<MicrophoneSetup onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(
        screen.getByText('Sounds Good — Start Practicing'),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Sounds Good — Start Practicing'))
    expect(onComplete).toHaveBeenCalled()
    expect(mockStopStream).toHaveBeenCalled()
  })

  it('shows returning user screen when permission already granted', () => {
    mockStatus = 'granted'
    useAudioStore.setState({ micPermission: 'granted' })
    render(<MicrophoneSetup />)
    expect(screen.getByText('Microphone Ready')).toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
  })
})
