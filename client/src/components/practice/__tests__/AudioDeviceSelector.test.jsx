import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AudioDeviceSelector from '../AudioDeviceSelector'

// Mock the useMicrophone hook
vi.mock('../../../hooks/useMicrophone', () => ({
  useMicrophone: vi.fn(() => ({
    audioDevices: [],
    selectedDeviceId: null,
    enumerateDevices: vi.fn(),
    status: 'idle',
  })),
}))

import { useMicrophone } from '../../../hooks/useMicrophone'

describe('AudioDeviceSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when there is 0 or 1 device', () => {
    useMicrophone.mockReturnValue({
      audioDevices: [{ deviceId: 'default', label: 'Default Mic' }],
      selectedDeviceId: null,
      enumerateDevices: vi.fn(),
      status: 'granted',
    })

    const { container } = render(
      <AudioDeviceSelector onDeviceChange={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders dropdown when multiple devices are available', () => {
    useMicrophone.mockReturnValue({
      audioDevices: [
        { deviceId: 'dev1', label: 'Built-in Mic' },
        { deviceId: 'dev2', label: 'USB Mic' },
      ],
      selectedDeviceId: 'dev1',
      enumerateDevices: vi.fn(),
      status: 'granted',
    })

    render(<AudioDeviceSelector onDeviceChange={vi.fn()} />)
    expect(screen.getByTestId('audio-device-selector')).toBeInTheDocument()
    expect(screen.getByText('Built-in Mic')).toBeInTheDocument()
    expect(screen.getByText('USB Mic')).toBeInTheDocument()
  })

  it('calls enumerateDevices when status is granted', () => {
    const enumerateDevices = vi.fn()
    useMicrophone.mockReturnValue({
      audioDevices: [],
      selectedDeviceId: null,
      enumerateDevices,
      status: 'granted',
    })

    render(<AudioDeviceSelector onDeviceChange={vi.fn()} />)
    expect(enumerateDevices).toHaveBeenCalled()
  })
})
