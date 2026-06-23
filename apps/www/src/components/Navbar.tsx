'use client'
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

const CustomNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // First check if user has explicitly set a preference
    const storedPreference = localStorage.getItem('darkMode')

    // Only use system preference if no stored preference exists
    const isDark =
      storedPreference !== null
        ? storedPreference === 'true'
        : window.matchMedia('(prefers-color-scheme: dark)').matches

    setIsDarkMode(isDark)

    // Apply dark mode class to document
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Set up intersection observer to detect active section
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

    // Observe sections
    const sections = document.querySelectorAll('section[id]')
    for (const section of Array.from(sections)) {
      observer.observe(section)
    }

    // Add home as active if user is at the top
    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveSection('home')
      }
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      for (const section of Array.from(sections)) {
        observer.unobserve(section)
      }
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)

    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    localStorage.setItem('darkMode', newDarkMode.toString())
  }

  const navItems = [
    {
      name: 'Features',
      link: '#agent',
    },
    {
      name: 'Install',
      link: '#install',
    },
    {
      name: 'FAQ',
      link: '#faq',
    },
  ]

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
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-white relative z-50 cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                  aria-label="Toggle dark mode"
                  type="button"
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </>
          )}
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <CustomLogo />
            <div className="flex items-center gap-2">
              <GitHubStars repoUrl={GITHUB_REPO} collapsed={true} />
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-white relative z-50 cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                aria-label="Toggle dark mode"
                type="button"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
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
                className={`relative text-neutral-600 dark:text-neutral-300 ${
                  activeSection === item.link.substring(1)
                    ? 'font-medium text-signal'
                    : ''
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
