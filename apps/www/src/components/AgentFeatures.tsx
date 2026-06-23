import { Check } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { ShellCommand } from './ShellCommand'

interface Agent {
  name: string
  code: string
  description: string
  features: string[]
}

const agentFeatures: Agent[] = [
  {
    name: 'Reviews on GitHub',
    code: 'CI',
    description:
      'Runs as a GitHub Action on every pull request. Reads the diff and posts focused inline comments plus a summary — like a human reviewer, minus the wait.',
    features: [
      'Catches exposed secrets and bugs',
      'Flags slow code and edge cases',
      'Points out missing tests',
    ],
  },
  {
    name: 'Explores your codebase',
    code: 'AGENT',
    description:
      'Built on the flue agent framework, Shippie runs a real agent loop with developer tools — so it reads far beyond the diff to understand the full picture.',
    features: [
      'Follows references, not just the diff',
      'Anthropic · OpenAI · OpenRouter · Cloudflare',
      'Open source and extendable',
    ],
  },
  {
    name: 'Extend it with MCP',
    code: 'MCP',
    description:
      'Acts as a Model Context Protocol client, so you can wire in external tools and give the agent more context while it reviews.',
    features: [
      'Browser automation to QA web apps',
      'Observability and docs servers',
      'Bring your own MCP servers',
    ],
  },
]

const AgentFeatures = () => {
  const [activeIndex, setActiveIndex] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % agentFeatures.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section id="agent" className="w-full border-t border-border/60">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center py-24 lg:py-32">
          <div className="flex flex-col items-center text-center">
            <span className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-signal">
              The inspection
            </span>
            <h2 className="max-w-3xl font-display text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold uppercase leading-[0.92] tracking-tight">
              A reviewer that reads the whole picture
            </h2>
            <p className="mt-5 max-w-xl text-balance text-muted-foreground">
              Shippie does the read-through a human reviewer would — on every change you
              ship.
            </p>
          </div>

          <div className="mt-16 grid w-full max-w-6xl grid-cols-1 gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
            {agentFeatures.map((agent, index) => (
              <div
                key={agent.name}
                className={cn(
                  'group relative flex flex-col bg-card p-8 transition-colors duration-500',
                  activeIndex === index ? 'bg-card' : 'hover:bg-secondary/60'
                )}
              >
                {/* active marker rail */}
                <span
                  className={cn(
                    'absolute left-0 top-0 h-full w-[3px] transition-colors duration-500',
                    activeIndex === index ? 'bg-signal' : 'bg-transparent'
                  )}
                />

                <div className="mb-6 flex items-baseline justify-between">
                  <span className="font-display text-5xl font-extrabold leading-none text-muted-foreground/25">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-500',
                      activeIndex === index
                        ? 'border-signal/50 text-signal'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    {agent.code}
                  </span>
                </div>

                <h3 className="font-display text-2xl font-bold uppercase tracking-tight">
                  {agent.name}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {agent.description}
                </p>

                <ul className="mt-7 space-y-2.5 border-t border-border pt-6">
                  {agent.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        weight="bold"
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 flex-shrink-0 transition-colors duration-500',
                          activeIndex === index
                            ? 'text-signal'
                            : 'text-muted-foreground/60'
                        )}
                      />
                      <span className="font-mono text-xs leading-relaxed text-foreground/80">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            id="install"
            className="mt-20 flex w-full max-w-xl flex-col items-center gap-4"
          >
            <h3 className="font-display text-3xl font-extrabold uppercase tracking-tight">
              Cleared in seconds
            </h3>
            <p className="text-center text-muted-foreground">
              Scaffold the GitHub Action, add your provider key as a repo secret, ship.
            </p>
            <ShellCommand command="npx shippie init" />
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
              Or run <span className="text-foreground/80">npx shippie review</span> on
              your staged changes
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AgentFeatures
