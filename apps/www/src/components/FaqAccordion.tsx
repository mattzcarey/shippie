import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion'

const FaqAccordion = () => {
  return (
    <div id="faq" className="w-full border-t border-border/60">
      <div className="container mx-auto px-6">
        <div className="flex gap-8 py-24 lg:py-32 items-center justify-center flex-col">
          <div className="flex flex-col items-center text-center">
            <span className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-signal">
              The fine print
            </span>
            <h2 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold uppercase leading-[0.92] tracking-tight">
              Questions, answered
            </h2>
          </div>

          <div className="w-full max-w-3xl mx-auto mt-6">
            <Accordion type="single" collapsible className="w-full space-y-3 text-sm">
              <AccordionItem
                className="border border-border bg-card/40 px-5 transition-colors hover:border-border/80"
                value="item-1"
              >
                <AccordionTrigger>What is Shippie?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Shippie is an extendable, open-source AI code review agent. It reads
                  your diff, explores the codebase with real developer tools, and posts
                  focused inline review comments plus a summary — catching issues a human
                  reviewer would, like exposed secrets, inefficient code, potential bugs,
                  unhandled edge cases, and missing tests.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                className="border border-border bg-card/40 px-5 transition-colors hover:border-border/80"
                value="item-2"
              >
                <AccordionTrigger>How do I run it?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Run <code className="font-mono text-foreground">npx shippie init</code>{' '}
                  to scaffold a GitHub Action that reviews every pull request, then add
                  your provider API key as a repo secret. You can also run{' '}
                  <code className="font-mono text-foreground">npx shippie review</code>{' '}
                  locally to review your staged changes (
                  <code className="font-mono text-foreground">git diff --cached</code>).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                className="border border-border bg-card/40 px-5 transition-colors hover:border-border/80"
                value="item-3"
              >
                <AccordionTrigger>Which AI providers does it support?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Shippie is provider-agnostic. Anthropic, OpenAI, OpenRouter, and
                  Cloudflare Workers AI are supported out of the box — just set the
                  matching API key.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                className="border border-border bg-card/40 px-5 transition-colors hover:border-border/80"
                value="item-4"
              >
                <AccordionTrigger>
                  Can I extend Shippie with my own tools?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes. Shippie acts as a Model Context Protocol (MCP) client, so you can
                  connect external tools — browser automation, observability, or
                  documentation servers — to give the agent more context during a review.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                className="border border-border bg-card/40 px-5 transition-colors hover:border-border/80"
                value="item-5"
              >
                <AccordionTrigger>Is Shippie open source?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes, Shippie is open source. You can read the code, file issues, and
                  contribute on{' '}
                  <a
                    href="https://github.com/mattzcarey/shippie"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4"
                  >
                    GitHub
                  </a>
                  .
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FaqAccordion
