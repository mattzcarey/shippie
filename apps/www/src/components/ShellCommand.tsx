import { Copy } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from './ui/button'

interface ShellCommandProps {
  command: string
}

const ShellCommand = ({ command }: ShellCommandProps) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white text-slate-900 font-mono rounded-md overflow-hidden w-full max-w-xl shadow-sm border border-slate-200">
      <div className="p-4 text-sm flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-green-600 mr-2">$</span>
          <span className="text-slate-700">{command}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="text-slate-500 hover:text-slate-700"
        >
          <Copy size={16} weight={copied ? 'fill' : 'regular'} />
        </Button>
      </div>
    </div>
  )
}

export { ShellCommand }
