import { forwardRef } from 'react'

const Select = forwardRef(function Select(
  {
    label,
    error,
    options = [],
    placeholder,
    className = '',
    children,
    ...props
  },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="font-body text-sm text-ivory-muted">{label}</label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={`w-full appearance-none bg-surface text-ivory border border-border rounded-md px-3 py-2 pr-8 font-body text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber focus:border-amber disabled:opacity-50 disabled:cursor-not-allowed ${error ? 'border-crimson focus:ring-crimson focus:border-crimson' : ''} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.length > 0
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {/* Dropdown chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ivory-muted max-w-4 max-h-4 w-4 h-4"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {error && <span className="font-body text-sm text-crimson">{error}</span>}
    </div>
  )
})

export default Select
