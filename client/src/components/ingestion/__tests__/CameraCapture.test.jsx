import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CameraCapture from '../CameraCapture'

// Mock the Button component
vi.mock('../../ui/Button', () => ({
  default: ({ children, onClick, disabled, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn(),
}

Object.defineProperty(navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true,
})

describe('CameraCapture', () => {
  const mockOnCapture = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockMediaDevices.getUserMedia.mockReset()
  })

  afterEach(() => {
    // Clean up any streams
  })

  it('renders the camera capture UI', () => {
    mockMediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [],
    })

    render(
      <CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />
    )

    expect(screen.getByText('Camera Capture')).toBeTruthy()
    expect(screen.getByText(/Align sheet music within the frame/i)).toBeTruthy()
  })

  it('shows error message when camera access is denied', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValue(
      new Error('Permission denied')
    )

    render(
      <CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />
    )

    await waitFor(() => {
      expect(screen.getByText(/Permission denied/i)).toBeTruthy()
    })
  })

  it('shows error message when no camera is found', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValue(
      new Error('NotFoundError')
    )

    render(
      <CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />
    )

    await waitFor(() => {
      expect(screen.getByText(/No camera found/i)).toBeTruthy()
    })
  })

  it('calls onCancel when cancel button is clicked', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValue(
      new Error('NotFoundError')
    )

    render(
      <CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />
    )

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
    })

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('has Try Again button when camera fails', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValue(
      new Error('Permission denied')
    )

    render(
      <CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />
    )

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeTruthy()
    })
  })
})
