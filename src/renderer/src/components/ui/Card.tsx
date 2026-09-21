import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** İç boşluk; varsayılan orta */
  padding?: 'none' | 'sm' | 'md'
}

const PADDING_CLASS = { none: '', sm: 'p-3', md: 'p-5' }

// Düz yüzey: dolgu ve ince çizgi, gölge ve degrade yok
function Card({ padding = 'md', className = '', children, ...rest }: CardProps): React.JSX.Element {
  return (
    <div
      className={`rounded-card border border-line bg-surface ${PADDING_CLASS[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export default Card
