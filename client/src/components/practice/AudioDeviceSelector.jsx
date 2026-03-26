import { useEffect } from 'react'
import { useMicrophone } from '../../hooks/useMicrophone'

/**
 * AudioDeviceSelector — dropdown for choosing an audio input device.
 * Enumerates available microphones after permission is granted.
 *
 * @param {object} props
 * @param {(deviceId: string) => void} props.onDeviceChange
 */
// eslint-disable-next-line react/prop-types
export default function AudioDeviceSelector({ onDeviceChange }) {
  const { audioDevices, selectedDeviceId, enumerateDevices, status } =
    useMicrophone()

  useEffect(() => {
    if (status === 'granted') {
      enumerateDevices()
    }
  }, [status, enumerateDevices])

  if (audioDevices.length <= 1) return null

  return (
    <div data-testid="audio-device-selector" className="flex flex-col gap-1.5">
      <label className="font-body text-sm text-ivory-muted">
        Audio Input Device
      </label>
      <select
        value={selectedDeviceId || ''}
        onChange={(e) => onDeviceChange(e.target.value)}
        className="w-full bg-surface text-ivory border border-border rounded-md px-3 py-2 font-body text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber focus:border-amber"
        data-testid="audio-device-select"
      >
        {audioDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </div>
  )
}
