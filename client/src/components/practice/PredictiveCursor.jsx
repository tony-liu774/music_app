/**
 * PredictiveCursor — glowing amber ball that overlays the VexFlow score
 * and tracks the current beat position during practice.
 *
 * Dynamic positioning requires inline styles for left/top (computed at
 * runtime from the score layout). Gradient backgrounds are defined in
 * app.css as .cursor-ball-gradient, .cursor-glow-gradient, and
 * .cursor-highlight-gradient to avoid inline styles and hardcoded hex codes.
 */
export default function PredictiveCursor({ x, y, visible, isBouncing }) {
  if (!visible) return null

  return (
    <div
      data-testid="predictive-cursor"
      className="absolute pointer-events-none z-10"
      // eslint-disable-next-line no-restricted-syntax -- dynamic x,y requires inline style
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
      }}
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
}
