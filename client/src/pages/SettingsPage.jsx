import { useAuth } from '../contexts/AuthContext'
import { useSettingsStore, INSTRUMENT_CONFIG } from '../stores/useSettingsStore'
import { Button, Card, Select } from '../components/ui'

const instrumentOptions = Object.entries(INSTRUMENT_CONFIG).map(
  ([value, { label }]) => ({
    value,
    label,
  }),
)

// eslint-disable-next-line react/prop-types
function SectionHeading({ children }) {
  return <h2 className="font-heading text-xl text-amber mb-4">{children}</h2>
}

// eslint-disable-next-line react/prop-types
function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = '',
  displayValue,
}) {
  const display = displayValue ?? `${value}${unit}`
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-body text-sm text-ivory-muted">{label}</label>
        <span className="font-mono text-sm text-amber">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-elevated accent-amber"
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-ivory-dim font-body">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const {
    instrument,
    tuningReference,
    confidenceThreshold,
    cursorSpeed,
    needleSensitivity,
    setInstrument,
    setTuningReference,
    setConfidenceThreshold,
    setCursorSpeed,
    setNeedleSensitivity,
    resetSettings,
  } = useSettingsStore()

  const instrumentConfig = INSTRUMENT_CONFIG[instrument]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-heading text-3xl text-amber">Settings</h1>
        <p className="font-body text-ivory-muted mt-1">
          Configure your practice preferences and account settings.
        </p>
      </div>

      {/* Instrument Selection */}
      <Card>
        <SectionHeading>Instrument</SectionHeading>
        <div className="space-y-4">
          <Select
            label="Select your instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            options={instrumentOptions}
            data-testid="instrument-select"
          />
          {instrumentConfig && (
            <div className="bg-elevated rounded-md p-3 space-y-1">
              <p className="font-body text-sm text-ivory-muted">
                <span className="text-ivory">Clef:</span>{' '}
                {instrumentConfig.clef.charAt(0).toUpperCase() +
                  instrumentConfig.clef.slice(1)}
              </p>
              <p className="font-body text-sm text-ivory-muted">
                <span className="text-ivory">Open strings:</span>{' '}
                {instrumentConfig.strings.join(', ')}
              </p>
              <p className="font-body text-sm text-ivory-muted">
                <span className="text-ivory">Range:</span>{' '}
                {instrumentConfig.frequencyRange.min}–
                {instrumentConfig.frequencyRange.max} Hz
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Tuning Reference */}
      <Card>
        <SectionHeading>Tuning Reference</SectionHeading>
        <SliderControl
          label="A4 Frequency"
          value={tuningReference}
          min={430}
          max={450}
          step={1}
          onChange={setTuningReference}
          unit=" Hz"
        />
      </Card>

      {/* Sensitivity */}
      <Card>
        <SectionHeading>Sensitivity</SectionHeading>
        <SliderControl
          label="Confidence Threshold"
          value={confidenceThreshold}
          min={0.7}
          max={0.95}
          step={0.01}
          onChange={setConfidenceThreshold}
        />
        <p className="font-body text-xs text-ivory-dim mt-2">
          Higher values require more confident pitch detection before displaying
          results.
        </p>
      </Card>

      {/* Display */}
      <Card>
        <SectionHeading>Display</SectionHeading>
        <div className="space-y-6">
          <SliderControl
            label="Cursor Speed"
            value={cursorSpeed}
            min={0.5}
            max={2.0}
            step={0.1}
            onChange={setCursorSpeed}
            displayValue={`${cursorSpeed}x`}
          />
          <SliderControl
            label="Needle Sensitivity"
            value={needleSensitivity}
            min={0.1}
            max={1.0}
            step={0.1}
            onChange={setNeedleSensitivity}
          />
        </div>
      </Card>

      {/* Account */}
      <Card>
        <SectionHeading>Account</SectionHeading>
        <div className="space-y-4">
          {user ? (
            <>
              <div className="bg-elevated rounded-md p-3 space-y-2">
                <p className="font-body text-sm text-ivory-muted">
                  <span className="text-ivory">Email:</span> {user.email}
                </p>
                {user.user_metadata?.full_name && (
                  <p className="font-body text-sm text-ivory-muted">
                    <span className="text-ivory">Name:</span>{' '}
                    {user.user_metadata.full_name}
                  </p>
                )}
                <p className="font-body text-sm text-ivory-muted">
                  <span className="text-ivory">Provider:</span>{' '}
                  {user.app_metadata?.provider ?? 'email'}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={signOut}
                data-testid="sign-out-button"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <p className="font-body text-sm text-ivory-muted">Not signed in.</p>
          )}
        </div>
      </Card>

      {/* Reset */}
      <div className="flex justify-end pb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetSettings}
          data-testid="reset-settings-button"
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}
