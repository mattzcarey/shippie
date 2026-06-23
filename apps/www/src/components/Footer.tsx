import { Anchor, GithubLogo } from '@phosphor-icons/react'

const GITHUB_REPO = 'https://github.com/mattzcarey/shippie'
const DOCS_URL = 'https://github.com/mattzcarey/shippie/tree/main/docs'
const NPM_URL = 'https://www.npmjs.com/package/shippie'

const links = [
  { label: 'GitHub', href: GITHUB_REPO, external: true },
  { label: 'Docs', href: DOCS_URL, external: true },
  { label: 'npm', href: NPM_URL, external: true },
  { label: 'FAQ', href: '#faq', external: false },
]

const Footer = () => {
  return (
    <footer className="w-full border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-col gap-8 py-14 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <a href="/" className="flex items-center gap-2">
              <Anchor size={20} weight="bold" className="text-signal" />
              <span className="font-display text-xl font-extrabold uppercase tracking-tight">
                Shippie
              </span>
            </a>
            <p className="max-w-xs text-sm text-muted-foreground">
              The AI reviewer that clears your code to merge.
            </p>
            <span className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/55">
              Manifest № SHP · open source
            </span>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs uppercase tracking-[0.14em]">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                {...(link.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-signal"
              >
                {link.label === 'GitHub' && <GithubLogo size={14} weight="fill" />}
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between border-t border-border py-6 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground/65">
          <p>© {new Date().getFullYear()} Shippie</p>
          <p>MIT license</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
