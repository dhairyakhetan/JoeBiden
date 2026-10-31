import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

const Card = ({ children, className = '', hover = false }: CardProps) => {
  return (
    <div
      className={`
        [background-color:var(--card)] rounded-2xl overflow-hidden
        ${hover ? 'card-hover' : ''}
        ${className}
      `}
      style={{ border: 'var(--hair-2)', boxShadow: 'var(--lift-1)' }}
    >
      {children}
    </div>
  )
}

interface CardSectionProps {
  children: ReactNode
  className?: string
}

Card.Header = ({ children, className = '' }: CardSectionProps) => (
  <div className={`px-5 py-4 border-b [border-color:var(--line)] ${className}`}>
    {children}
  </div>
)

Card.Body = ({ children, className = '' }: CardSectionProps) => (
  <div className={`px-5 py-4 ${className}`}>
    {children}
  </div>
)

Card.Footer = ({ children, className = '' }: CardSectionProps) => (
  <div className={`px-5 py-4 border-t [border-color:var(--line)] [background-color:var(--surface)] ${className}`}>
    {children}
  </div>
)

export default Card
