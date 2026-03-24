import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react'

const variantClasses = {
  success: 'bg-elevated border-emerald text-ivory',
  error: 'bg-elevated border-crimson text-ivory',
  info: 'bg-elevated border-amber text-ivory',
}

const iconPaths = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5v6m0 4h.01',
}

const iconColors = {
  success: 'text-emerald',
  error: 'text-crimson',
  info: 'text-amber',
}

function ToastItem({
  id,
  variant = 'info',
  message,
  duration = 4000,
  onDismiss,
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true))

    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onDismiss(id), 200)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [id, duration, onDismiss])

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 border-l-4 rounded-md shadow-lg transition-all duration-200 ${variantClasses[variant] || variantClasses.info} ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`max-w-5 max-h-5 w-5 h-5 shrink-0 ${iconColors[variant] || iconColors.info}`}
      >
        <path d={iconPaths[variant] || iconPaths.info} />
      </svg>
      <span className="font-body text-sm flex-1">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => onDismiss(id), 200)
        }}
        className="text-ivory-muted hover:text-ivory transition-colors shrink-0"
        aria-label="Dismiss notification"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="max-w-4 max-h-4 w-4 h-4"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

const ToastContext = createContext(null)

let toastIdCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { ...toast, id }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast container — bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} {...toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default ToastItem
