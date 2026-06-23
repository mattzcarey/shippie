import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion'

const FaqAccordion = () => {
  return (
    <div id="faq" className="w-full">
      <div className="container mx-auto">
        <div className="flex gap-8 py-20 lg:py-32 items-center justify-center flex-col">
          <div className="flex gap-4 flex-col">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-center">
              Frequently Asked Questions
            </h2>
            <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center mx-auto">
              Find answers to common questions about Shippie
            </p>
          </div>

          <div className="w-full max-w-3xl mx-auto mt-8">
            <Accordion type="single" collapsible className="w-full space-y-4 text-sm">
              <AccordionItem
                className="rounded border bg-primary-foreground px-4"
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
                className="rounded border bg-primary-foreground px-4"
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
                className="rounded border bg-primary-foreground px-4"
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
                className="rounded border bg-primary-foreground px-4"
                value="item-4"
              >
                <AccordionTrigger>Can I extend Shippie with my own tools?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes. Shippie acts as a Model Context Protocol (MCP) client, so you can
                  connect external tools — browser automation, observability, or
                  documentation servers — to give the agent more context during a review.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                className="rounded border bg-primary-foreground px-4"
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
