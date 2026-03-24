function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg p-6 transition-shadow duration-300 hover:shadow-amber-glow hover:border-border-light ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
