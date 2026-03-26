import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Number of bars in the level meter display.
 */
const BAR_COUNT = 20

/**
 * Pre-computed height classes for each bar index.
 * Heights ramp from small to full container height.
 */
const BAR_HEIGHTS = [
  'h-2.5',
  'h-3',
  'h-3.5',
  'h-4',
  'h-4.5',
  'h-5',
  'h-5.5',
  'h-6',
  'h-6.5',
  'h-7',
  'h-7.5',
  'h-8',
  'h-8.5',
  'h-9',
  'h-9.5',
  'h-10',
  'h-10.5',
  'h-11',
  'h-11.5',
  'h-12',
]

/**
 * Compute RMS level (0–1) from an AnalyserNode's time-domain data.
 * Shared logic used by the rAF loop.
 */
function computeRmsLevel(analyser, buffer) {
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const sample = (buffer[i] - 128) / 128
    sum += sample * sample
  }
  return Math.min(1, Math.sqrt(sum / buffer.length) * 3)
}

/**
 * Real-time audio input level meter.
 * Reads RMS level from an AnalyserNode and renders a bar-style visualization.
 *
 * Accepts an optional `analyserNode` prop to reuse an existing AnalyserNode
 * (e.g., from AudioEngine) instead of creating a new AudioContext. Falls back
 * to creating a standalone AudioContext from the `stream` prop when no
 * analyserNode is provided. This avoids leaking AudioContexts on remount
 * and avoids hitting the browser's concurrent context limit.
 *
 * @param {object} props
 * @param {MediaStream|null} [props.stream] — active MediaStream (used only when analyserNode is not provided)
 * @param {AnalyserNode|null} [props.analyserNode] — external AnalyserNode to read from
 * @param {boolean} [props.active=false] — whether to animate
 */
export default function InputLevelMeter({
  stream,
  analyserNode = null,
  active = false,
}) {
  const [level, setLevel] = useState(0)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const rafRef = useRef(null)
  const bufferRef = useRef(null)

  const updateLevel = useCallback(() => {
    if (!analyserRef.current || !bufferRef.current) return
    setLevel(computeRmsLevel(analyserRef.current, bufferRef.current))
    rafRef.current = requestAnimationFrame(updateLevel)
  }, [])

  // When an external analyserNode is provided, use it directly
  useEffect(() => {
    if (!analyserNode || !active) return

    analyserRef.current = analyserNode
    bufferRef.current = new Uint8Array(analyserNode.frequencyBinCount)
    rafRef.current = requestAnimationFrame(updateLevel)

    return () => {
      cancelAnimationFrame(rafRef.current)
      // Don't disconnect — we don't own the external analyser
      analyserRef.current = null
      bufferRef.current = null
    }
  }, [analyserNode, active, updateLevel])

  // Fallback: create a standalone AudioContext from the stream
  useEffect(() => {
    // Skip if an external analyserNode is provided, or if no stream/active
    if (analyserNode || !stream || !active) {
      if (!analyserNode) setLevel(0)
      return
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    audioCtxRef.current = ctx

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyserRef.current = analyser
    bufferRef.current = new Uint8Array(analyser.frequencyBinCount)

    const source = ctx.createMediaStreamSource(stream)
    sourceRef.current = source
    source.connect(analyser)

    rafRef.current = requestAnimationFrame(updateLevel)

    return () => {
      cancelAnimationFrame(rafRef.current)
      source.disconnect()
      ctx.close()
      analyserRef.current = null
      audioCtxRef.current = null
      sourceRef.current = null
      bufferRef.current = null
    }
  }, [analyserNode, stream, active, updateLevel])

  const activeBars = Math.round(level * BAR_COUNT)

  return (
    <div
      className="flex items-end gap-0.5 h-12 justify-center"
      role="meter"
      aria-valuenow={Math.round(level * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Microphone input level"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const isActive = i < activeBars
        let colorClass = 'bg-emerald'
        if (i >= BAR_COUNT * 0.8) colorClass = 'bg-crimson'
        else if (i >= BAR_COUNT * 0.6) colorClass = 'bg-amber'

        return (
          <div
            key={i}
            className={`w-2 rounded-sm transition-all duration-75 ${BAR_HEIGHTS[i]} ${
              isActive ? colorClass : 'bg-surface'
            }`}
          />
        )
      })}
    </div>
  )
}
