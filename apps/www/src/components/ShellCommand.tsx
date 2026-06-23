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
    <div className="group relative w-full max-w-xl border border-border bg-card/50 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur">
      {/* corner registration ticks */}
      <span className="pointer-events-none absolute -left-px -top-px h-2 w-2 border-l-2 border-t-2 border-signal/60" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-signal/60" />
      <div className="flex items-center justify-between gap-3 px-5 py-4 font-mono text-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="select-none font-bold text-signal">$</span>
          <span className="truncate text-foreground/90">{command}</span>
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          aria-label="Copy command"
          className="flex shrink-0 items-center gap-1.5 border border-transparent px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          {copied ? (
            <>
              <Check size={13} weight="bold" className="text-signal" />
              Copied
            </>
          ) : (
            <>
              <Copy size={13} />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export { ShellCommand }
