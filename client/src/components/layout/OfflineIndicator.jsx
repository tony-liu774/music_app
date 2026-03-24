/**
 * OfflineIndicator — subtle ivory-dim "Offline" badge displayed in the nav
 * bar when the device is disconnected.
 */
export default function OfflineIndicator({ isOnline, pendingCount = 0 }) {
  if (isOnline) return null

  return (
    <span
      data-testid="offline-indicator"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated border border-border text-ivory-dim text-xs font-body"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-ivory-dim animate-pulse" />
      Offline
      {pendingCount > 0 && (
        <span className="text-amber ml-0.5">({pendingCount})</span>
      )}
    </span>
  )
}
