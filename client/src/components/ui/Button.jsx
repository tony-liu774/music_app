import { forwardRef } from 'react'

const variantClasses = {
  primary:
    'bg-amber text-oxford-blue hover:bg-amber-light hover:shadow-amber-glow focus:shadow-amber-glow',
  secondary:
    'bg-surface text-ivory border border-border hover:bg-hover hover:border-border-light focus:shadow-amber-glow',
  ghost:
    'bg-transparent text-ivory hover:bg-hover focus:shadow-amber-glow',
  danger:
    'bg-crimson text-ivory hover:bg-crimson-light hover:shadow-crimson-glow focus:shadow-crimson-glow',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = '',
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-body font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2 focus:ring-offset-oxford-blue disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})

export default Button
