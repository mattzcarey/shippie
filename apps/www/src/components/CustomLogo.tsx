import { Anchor } from '@phosphor-icons/react'
import { cn } from '../lib/utils'

interface CustomLogoProps {
  className?: string
}

const CustomLogo = ({ className }: CustomLogoProps) => {
  return (
    <a
      href="/"
      className={cn('relative z-20 mr-4 flex items-center gap-2 px-2 py-1', className)}
    >
      <Anchor size={22} weight="bold" className="text-signal" />
      <span className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
        Shippie
      </span>
    </a>
  )
}

export default CustomLogo
