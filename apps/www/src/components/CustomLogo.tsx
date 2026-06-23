import { Rocket } from '@phosphor-icons/react'
import { cn } from '../lib/utils'

interface CustomLogoProps {
  className?: string
}

const CustomLogo = ({ className }: CustomLogoProps) => {
  return (
    <a
      href="/"
      className={cn(
        'relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal',
        className
      )}
    >
      <Rocket size={30} weight="fill" className="text-black dark:text-white" />
      <span className="font-medium text-black dark:text-white">Shippie</span>
    </a>
  )
}

export default CustomLogo
