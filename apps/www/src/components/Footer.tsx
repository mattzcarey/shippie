import { GithubLogo, Rocket } from '@phosphor-icons/react'

const GITHUB_REPO = 'https://github.com/mattzcarey/shippie'
const DOCS_URL = 'https://github.com/mattzcarey/shippie/tree/main/docs'
const NPM_URL = 'https://www.npmjs.com/package/shippie'

const Footer = () => {
  return (
    <footer className="w-full border-t border-gray-200 dark:border-neutral-800">
      <div className="container mx-auto">
        <div className="flex flex-col gap-8 py-12 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <a href="/" className="flex items-center gap-2">
              <Rocket size={24} weight="fill" className="text-black dark:text-white" />
              <span className="font-medium text-black dark:text-white">Shippie</span>
            </a>
            <p className="max-w-xs text-sm text-muted-foreground">
              An extendable, open-source AI code review agent.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <GithubLogo size={16} weight="fill" /> GitHub
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </a>
            <a
              href={NPM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              npm
            </a>
            <a
              href="#faq"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              FAQ
            </a>
          </nav>
        </div>

        <div className="border-t border-gray-200 py-6 text-sm text-muted-foreground dark:border-neutral-800">
          <p>© {new Date().getFullYear()} Shippie · Open source under the MIT license.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
