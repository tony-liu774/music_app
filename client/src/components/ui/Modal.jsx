import { useEffect, useRef, useCallback } from 'react'

function Modal({ isOpen, onClose, title, children, className = '' }) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return

        const focusableElements = dialog.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusableElements.length === 0) return

        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      document.body.style.overflow = 'hidden'

      // Focus the first focusable element inside the modal
      requestAnimationFrame(() => {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusable = dialog.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable) focusable.focus()
      })
    } else {
      document.body.style.overflow = ''
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-oxford-blue/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        data-testid="modal-backdrop"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full max-w-lg bg-elevated border border-border rounded-lg shadow-lg animate-slide-up ${className}`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-heading text-xl text-ivory">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-ivory-muted hover:text-ivory transition-colors p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-amber"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="max-w-5 max-h-5 w-5 h-5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 text-ivory">{children}</div>
      </div>
    </div>
  )
}

export default Modal
