'use client'
import { Switch } from '@cloudflare/kumo/components/switch'
import { Moon, Sun } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import CustomLogo from './CustomLogo'
import GitHubStars from './GitHubStars'
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  NavItems,
  Navbar,
  NavbarButton,
} from './ui/resizable-navbar'

const GITHUB_REPO = 'https://github.com/mattzcarey/shippie'
const DOCS_URL = 'https://github.com/mattzcarey/shippie/tree/main/docs'

type Mode = 'light' | 'dark'

const CustomNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [mode, setMode] = useState<Mode>('dark')

  useEffect(() => {
    // the inline script in index.html already set data-mode before paint
    const current =
      (document.documentElement.getAttribute('data-mode') as Mode | null) ?? 'dark'
    setMode(current)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.id) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { threshold: 0.5 }
    )

    const sections = document.querySelectorAll('section[id]')
    for (const section of Array.from(sections)) {
      observer.observe(section)
    }

    const handleScroll = () => {
      if (window.scrollY < 100) setActiveSection('home')
    }
    window.addEventListener('scroll', handleScroll)

    return () => {
      for (const section of Array.from(sections)) observer.unobserve(section)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const applyMode = (next: Mode) => {
    setMode(next)
    document.documentElement.setAttribute('data-mode', next)
    try {
      localStorage.setItem('mode', next)
    } catch {
      // ignore storage failures
    }
  }

  const navItems = [
    { name: 'Features', link: '#agent' },
    { name: 'Install', link: '#install' },
    { name: 'FAQ', link: '#faq' },
  ]

  const modeToggle = (
    <div className="flex items-center gap-2 text-kumo-subtle">
      <Sun size={15} weight={mode === 'light' ? 'fill' : 'regular'} />
      <Switch
        size="base"
        checked={mode === 'dark'}
        onCheckedChange={(checked) => applyMode(checked ? 'dark' : 'light')}
        aria-label="Toggle dark mode"
      />
      <Moon size={15} weight={mode === 'dark' ? 'fill' : 'regular'} />
    </div>
  )

  return (
    <div className="relative w-full">
      <Navbar position="fixed">
        {/* Desktop Navigation */}
        <NavBody>
          {({ visible }) => (
            <>
              <CustomLogo />
              <NavItems items={navItems} activeSection={activeSection} />
              <div className="flex items-center gap-4">
                <NavbarButton
                  variant="secondary"
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-normal"
                >
                  {visible ? 'Docs' : 'Documentation'}
                </NavbarButton>
                <GitHubStars repoUrl={GITHUB_REPO} visible={visible} />
                {modeToggle}
              </div>
            </>
          )}
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <CustomLogo />
            <div className="flex items-center gap-3">
              <GitHubStars repoUrl={GITHUB_REPO} collapsed={true} />
              {modeToggle}
              <MobileNavToggle
                isOpen={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              />
            </div>
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item) => (
              <a
                key={item.link}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`relative font-mono text-sm uppercase tracking-[0.12em] ${
                  activeSection === item.link.substring(1)
                    ? 'font-semibold text-signal'
                    : 'text-muted-foreground'
                }`}
              >
                <span className="block">{item.name}</span>
              </a>
            ))}
            <div className="flex w-full flex-col gap-4">
              <GitHubStars repoUrl={GITHUB_REPO} />
              <NavbarButton
                as="a"
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                variant="primary"
                className="w-full font-normal"
              >
                Docs
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </div>
  )
}

export default CustomNavbar
