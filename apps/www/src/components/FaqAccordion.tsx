import { Collapsible } from '@cloudflare/kumo/components/collapsible'
import type { ReactNode } from 'react'

const GITHUB_REPO = 'https://github.com/mattzcarey/shippie'

interface Faq {
  q: string
  a: ReactNode
}

const faqs: Faq[] = [
  {
    q: 'What is Shippie?',
    a: (
      <>
        Shippie is an extendable, open-source AI code review agent. It reads your diff,
        explores the codebase with real developer tools, and posts focused inline review
        comments plus a summary — catching issues a human reviewer would, like exposed
        secrets, inefficient code, potential bugs, unhandled edge cases, and missing
        tests.
      </>
    ),
  },
  {
    q: 'How do I run it?',
    a: (
      <>
        Run <code className="font-mono text-foreground">npx shippie init</code> to
        scaffold a GitHub Action that reviews every pull request, then add your provider
        API key as a repo secret. You can also run{' '}
        <code className="font-mono text-foreground">npx shippie review</code> locally to
        review your staged changes (
        <code className="font-mono text-foreground">git diff --cached</code>).
      </>
    ),
  },
  {
    q: 'Which AI providers does it support?',
    a: (
      <>
        Shippie is provider-agnostic. Anthropic, OpenAI, OpenRouter, and Cloudflare
        Workers AI are supported out of the box — just set the matching API key.
      </>
    ),
  },
  {
    q: 'Can I extend Shippie with my own tools?',
    a: (
      <>
        Yes. Shippie acts as a Model Context Protocol (MCP) client, so you can connect
        external tools — browser automation, observability, or documentation servers — to
        give the agent more context during a review.
      </>
    ),
  },
  {
    q: 'Is Shippie open source?',
    a: (
      <>
        Yes. You can read the code, file issues, and contribute on{' '}
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal underline underline-offset-4"
        >
          GitHub
        </a>
        .
      </>
    ),
  },
]

const FaqAccordion = () => {
  return (
    <div id="faq" className="w-full border-t border-border/60">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center gap-8 py-24 lg:py-32">
          <div className="flex flex-col items-center text-center">
            <span className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-signal">
              The fine print
            </span>
            <h2 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold uppercase leading-[0.92] tracking-tight">
              Questions, answered
            </h2>
          </div>

          <div className="mt-2 w-full max-w-3xl space-y-3">
            {faqs.map((faq) => (
              <Collapsible.Root
                key={faq.q}
                className="border border-border bg-card/40 px-5 transition-colors hover:border-border/80"
              >
                <Collapsible.DefaultTrigger>
                  <span className="text-left font-medium text-foreground">{faq.q}</span>
                </Collapsible.DefaultTrigger>
                <Collapsible.DefaultPanel>
                  <div className="pb-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                </Collapsible.DefaultPanel>
              </Collapsible.Root>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FaqAccordion
