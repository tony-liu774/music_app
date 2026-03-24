import { useSettingsStore, INSTRUMENT_CONFIG } from '../../stores/useSettingsStore'

/* eslint-disable react/prop-types */

/**
 * Note frequency lookup — maps note names (e.g. 'A4') to Hz at A4=440.
 * Used to display reference frequencies for open strings.
 */
const NOTE_FREQUENCIES = {
  E1: 41.2,
  A1: 55.0,
  D2: 73.42,
  G2: 98.0,
  C2: 65.41,
  C3: 130.81,
  G3: 196.0,
  D3: 146.83,
  A3: 220.0,
  D4: 293.66,
  A4: 440.0,
  G4: 392.0,
  E5: 659.26,
}

/**
 * TunerDisplay — shows detected note name, frequency readout,
 * cents deviation, and open string reference pitches.
 *
 * Props:
 * - note: string|null — detected note name (e.g. 'A4')
 * - frequency: number|null — detected frequency in Hz
 * - cents: number|null — cents deviation from nearest note
 * - confidence: number — detection confidence (0-1)
 * - isActive: boolean — whether the tuner is listening
 */
export default function TunerDisplay({
  note = null,
  frequency = null,
  cents = null,
  isActive = false,
}) {
  const instrument = useSettingsStore((s) => s.instrument)
  const config = INSTRUMENT_CONFIG[instrument]

  // Parse note name and octave
  const noteName = note ? note.replace(/\d+$/, '') : '--'
  const noteOctave = note ? note.replace(/^[A-G]#?/, '') : ''

  // Cents display text
  const centsText =
    cents !== null ? (cents > 0 ? `+${Math.round(cents)}` : `${Math.round(cents)}`) : '0'

  // Cents color
  const absCents = Math.abs(cents || 0)
  let centsColor = 'text-ivory-muted'
  if (isActive && cents !== null) {
    if (absCents <= 5) centsColor = 'text-emerald'
    else if (absCents <= 15) centsColor = 'text-amber'
    else centsColor = 'text-crimson'
  }

  return (
    <div className="flex flex-col items-center gap-4" data-testid="tuner-display">
      {/* Detected note name */}
      <div className="flex items-baseline gap-1" data-testid="note-display">
        <span className="font-heading text-7xl text-ivory leading-none">
          {noteName}
        </span>
        <span className="font-mono text-2xl text-ivory-muted">{noteOctave}</span>
      </div>

      {/* Frequency readout */}
      <p className="font-body text-lg text-ivory-muted" data-testid="frequency-display">
        {frequency ? `${frequency.toFixed(1)} Hz` : '-- Hz'}
      </p>

      {/* Cents deviation */}
      <p
        className={`font-mono text-2xl font-semibold ${centsColor}`}
        data-testid="cents-display"
      >
        {centsText}¢
      </p>

      {/* Open string references */}
      {config && (
        <div
          className="mt-4 flex flex-col items-center gap-2"
          data-testid="open-strings"
        >
          <span className="font-body text-sm text-ivory-dim uppercase tracking-wider">
            {config.label} Open Strings
          </span>
          <div className="flex gap-3">
            {config.strings.map((stringNote) => {
              const isMatch = note === stringNote
              const freq = NOTE_FREQUENCIES[stringNote]
              return (
                <button
                  key={stringNote}
                  type="button"
                  className={`flex flex-col items-center rounded-lg border px-3 py-2 transition-colors ${
                    isMatch
                      ? 'border-amber bg-amber/10 text-amber'
                      : 'border-border text-ivory-muted hover:border-border-light'
                  }`}
                >
                  <span className="font-heading text-lg">{stringNote}</span>
                  {freq && (
                    <span className="font-mono text-xs text-ivory-dim">
                      {freq.toFixed(0)} Hz
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
