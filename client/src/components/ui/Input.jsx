import { forwardRef } from 'react'

const Input = forwardRef(function Input(
  { label, error, className = '', ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="font-body text-sm text-ivory-muted">{label}</label>
      )}
      <input
        ref={ref}
        className={`w-full bg-surface text-ivory placeholder-ivory-dim border border-border rounded-md px-3 py-2 font-body text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber focus:border-amber disabled:opacity-50 disabled:cursor-not-allowed ${error ? 'border-crimson focus:ring-crimson focus:border-crimson' : ''} ${className}`}
        {...props}
      />
      {error && (
        <span className="font-body text-sm text-crimson">{error}</span>
      )}
    </div>
  )
})

export default Input
