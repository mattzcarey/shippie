import { Check } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { ShellCommand } from './ShellCommand'

interface AgentFeature {
  title: string
  description?: string
}

interface Agent {
  name: string
  description: string
  features: AgentFeature[]
  highlighted?: boolean
}

const agentFeatures: Agent[] = [
  {
    name: 'Reviews on GitHub',
    description:
      'Shippie runs as a GitHub Action on your pull requests. It reads the diff and posts focused inline comments plus a summary, just like a human reviewer.',
    features: [
      { title: 'Catches exposed secrets and potential bugs' },
      { title: 'Flags slow or inefficient code and unhandled edge cases' },
      { title: 'Points out missing tests' },
    ],
  },
  {
    name: 'Explores your codebase',
    description:
      'Built on the flue agent framework, Shippie runs an agent loop with real developer tools — so it reads beyond the diff to understand the full picture.',
    features: [
      { title: 'Navigates files and follows references, not just the diff' },
      { title: 'Provider-agnostic: Anthropic, OpenAI, OpenRouter, Cloudflare' },
      { title: 'Open source and extendable to fit your workflow' },
    ],
    highlighted: true,
  },
  {
    name: 'Extend it with MCP',
    description:
      'Shippie acts as a Model Context Protocol (MCP) client, so you can connect external tools and give the agent more context during a review.',
    features: [
      { title: 'Browser automation to QA web apps' },
      { title: 'Observability and documentation servers' },
      { title: 'Bring your own MCP servers' },
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
    <div id="agent" className="w-full">
      <div className="container mx-auto">
        <div className="flex gap-8 py-20 lg:py-32 items-center justify-center flex-col">
          <div className="flex gap-4 flex-col">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-center">
              A reviewer that reads the whole picture
            </h2>
            <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center mx-auto">
              Shippie does the read-through a human reviewer would, on every change you
              ship.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-8">
            {agentFeatures.map((agentFeature, index) => (
              <div
                key={agentFeature.name}
                className={cn(
                  'rounded-xl overflow-hidden border transition-all duration-500',
                  activeIndex === index
                    ? 'border-red-500 border-2 shadow-lg shadow-red-200 dark:shadow-red-900/30 scale-105 transform'
                    : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                )}
              >
                <div
                  className={cn(
                    'p-8',
                    activeIndex === index
                      ? 'bg-red-50 dark:bg-red-900/10'
                      : 'bg-white dark:bg-neutral-900'
                  )}
                >
                  <h3 className="text-xl font-bold mb-4">{agentFeature.name}</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {agentFeature.description}
                  </p>
                </div>

                <div className="p-8 bg-gray-50 dark:bg-neutral-800 space-y-4">
                  <h4 className="text-sm uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-4">
                    Highlights
                  </h4>

                  {agentFeature.features.map((feature) => (
                    <div key={feature.title} className="flex items-start mb-3">
                      <Check
                        weight="bold"
                        className={cn(
                          'h-5 w-5 mr-3 flex-shrink-0 mt-0.5',
                          activeIndex === index ? 'text-red-500' : 'text-green-500'
                        )}
                      />
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-200">
                          {feature.title}
                        </span>
                        {feature.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {feature.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            id="install"
            className="flex flex-col items-center gap-4 mt-8 w-full max-w-xl"
          >
            <h3 className="text-2xl font-bold tracking-tighter text-center">
              Get started in seconds
            </h3>
            <p className="text-muted-foreground text-center">
              Scaffold the GitHub Action workflow, then add your provider API key as a
              repo secret.
            </p>
            <ShellCommand command="npx shippie init" />
            <p className="text-sm text-muted-foreground text-center">
              Prefer to try it locally first? Run{' '}
              <code className="font-mono text-foreground">npx shippie review</code> to
              review your staged changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentFeatures
