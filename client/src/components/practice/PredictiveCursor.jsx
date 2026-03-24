import { forwardRef } from 'react'

/**
 * PredictiveCursor — glowing amber ball that overlays the VexFlow score
 * and tracks the current beat position during practice.
 *
 * Position is updated directly via the forwarded ref (style.left/top)
 * from the animation loop for 60fps performance — no React re-renders
 * per frame. Only `isBouncing` triggers re-renders (on beat boundaries).
 */
const PredictiveCursor = forwardRef(function PredictiveCursor(
  { visible, isBouncing },
  ref,
) {
  if (!visible) return null

  return (
    <div
      ref={ref}
      data-testid="predictive-cursor"
      className="absolute pointer-events-none z-10"
      // eslint-disable-next-line no-restricted-syntax -- position updated by ref in animation loop
      style={{ left: '0px', top: '0px', transform: 'translate(-50%, -50%)' }}
    >
      {/* Glow layer */}
      <div
        data-testid="cursor-glow"
        className={`absolute inset-0 w-20 h-20 rounded-full -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 cursor-glow-gradient ${
          isBouncing ? 'animate-glow-bounce' : 'animate-glow-pulse'
        }`}
      />

      {/* Ball */}
      <div
        data-testid="cursor-ball"
        className={`relative w-10 h-10 rounded-full shadow-amber-glow cursor-ball-gradient ${
          isBouncing ? 'animate-ball-bounce' : 'animate-ball-pulse'
        }`}
      >
        {/* Highlight spot */}
        <div className="absolute w-3 h-3 rounded-full top-1.5 left-2 cursor-highlight-gradient" />
      </div>
    </div>
  )
})

export default PredictiveCursor
