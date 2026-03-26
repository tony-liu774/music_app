import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MicPermissionModal from '../MicPermissionModal'
import { useAudioStore } from '../../../stores/useAudioStore'

// Mock getUserMedia globally
function setupMediaDevices(getUserMediaMock) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    writable: true,
    configurable: true,
  })
}

function setupPermissions(state) {
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn().mockResolvedValue({ state }) },
    writable: true,
    configurable: true,
  })
}

// Helper to create a mock MediaStream
function createMockStream() {
  const track = { stop: vi.fn(), kind: 'audio' }
  return { getTracks: () => [track], _track: track }
}

describe('MicPermissionModal', () => {
  let originalMediaDevices
  let originalPermissions
  let originalIsSecureContext

  beforeEach(() => {
    useAudioStore.setState({ micPermission: 'prompt' })
    localStorage.clear()

    originalMediaDevices = navigator.mediaDevices
    originalPermissions = navigator.permissions
    originalIsSecureContext = window.isSecureContext

    setupMediaDevices(vi.fn())
    setupPermissions('prompt')

    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'permissions', {
      value: originalPermissions,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      writable: true,
      configurable: true,
    })
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <MicPermissionModal isOpen={false} onClose={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the modal with title when isOpen is true', () => {
    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Microphone Setup')).toBeInTheDocument()
  })

  it('shows the initial prompt with explanation text', () => {
    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText("Let's Tune In")).toBeInTheDocument()
    expect(
      screen.getByText(/listens to your playing in real-time/),
    ).toBeInTheDocument()
    expect(screen.getByText('Allow Microphone')).toBeInTheDocument()
  })

  it('shows granted state after successful permission', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(screen.getByText('Microphone Connected')).toBeInTheDocument()
    })
    expect(screen.getByText('Start Practicing')).toBeInTheDocument()
  })

  it('shows denied state when user denies permission', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError'),
    )

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(screen.getByText('Microphone Access Denied')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Click the lock\/settings icon/),
    ).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('shows unsupported content when browser lacks getUserMedia', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Browser Not Supported')).toBeInTheDocument()
    expect(
      screen.getByText(/does not support microphone access/),
    ).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<MicPermissionModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onComplete and onClose when Start Practicing is clicked', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)
    const onComplete = vi.fn()
    const onClose = vi.fn()

    render(
      <MicPermissionModal
        isOpen={true}
        onClose={onClose}
        onComplete={onComplete}
      />,
    )

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(screen.getByText('Start Practicing')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Start Practicing'))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets to idle state when Try Again is clicked after denial', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError'),
    )

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(screen.getByText('Microphone Access Denied')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Try Again'))

    await waitFor(() => {
      expect(screen.getByText("Let's Tune In")).toBeInTheDocument()
    })
  })

  it('shows "Waiting for Permission..." while prompting', async () => {
    // Make getUserMedia never resolve
    navigator.mediaDevices.getUserMedia.mockReturnValue(new Promise(() => {}))

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(screen.getByText('Waiting for Permission...')).toBeInTheDocument()
    })
  })

  it('updates audio store on permission grant', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(useAudioStore.getState().micPermission).toBe('granted')
    })
  })

  it('updates audio store on permission deny', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError'),
    )

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(useAudioStore.getState().micPermission).toBe('denied')
    })
  })

  it('stops the stream tracks after granting permission in the modal', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(screen.getByText('Microphone Connected')).toBeInTheDocument()
    })

    // The modal stops the stream after getting permission confirmation
    expect(mockStream._track.stop).toHaveBeenCalled()
  })

  it('persists granted state to localStorage', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Allow Microphone'))

    await waitFor(() => {
      expect(localStorage.getItem('mic_permission_state')).toBe('granted')
    })
  })

  it('shows granted state for returning users with persisted grant', () => {
    localStorage.setItem('mic_permission_state', 'granted')

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Microphone Connected')).toBeInTheDocument()
    expect(screen.getByText('Start Practicing')).toBeInTheDocument()
  })

  it('shows HTTPS notice for error state caused by insecure context', () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      writable: true,
      configurable: true,
    })

    render(<MicPermissionModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Secure Connection Required')).toBeInTheDocument()
  })
})
