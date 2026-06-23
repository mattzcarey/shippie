import { Check, Copy } from '@phosphor-icons/react'
import { useState } from 'react'

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
    <div className="group relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card/40 shadow-xl shadow-black/30 backdrop-blur">
      {/* faint top highlight for a glassy terminal feel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="flex items-center justify-between gap-3 px-5 py-4 font-mono text-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="select-none text-emerald-400">$</span>
          <span className="truncate text-foreground/90">{command}</span>
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          aria-label="Copy command"
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check size={14} weight="bold" className="text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export { ShellCommand }
