import { motion } from 'framer-motion'
import { GithubLogo } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { ShellCommand } from './ShellCommand'
import { Button } from './ui/button'

const GITHUB_REPO = 'https://github.com/mattzcarey/shippie'

const Hero = () => {
  const [titleNumber, setTitleNumber] = useState(0)
  const titles = useMemo(
    () => ['pull request', 'merge', 'commit', 'release', 'staged diff'],
    []
  )
  // Reserve space for the widest word so the line never reflows as it rotates.
  const longestTitle = useMemo(
    () => titles.reduce((a, b) => (b.length >= a.length ? b : a), ''),
    [titles]
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0)
      } else {
        setTitleNumber(titleNumber + 1)
      }
    }, 2000)
    return () => clearTimeout(timeoutId)
  }, [titleNumber, titles])

  return (
    <div className="w-full pt-14">
      <div className="container mx-auto">
        <div className="flex gap-8 py-20 pb-12 lg:py-32 lg:pb-16 items-center justify-center flex-col">
          <div>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              asChild
            >
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
                <GithubLogo size={16} weight="fill" /> Open source on GitHub
              </a>
            </Button>
          </div>
          <div className="flex gap-4 flex-col">
            <h1 className="text-5xl md:text-7xl max-w-3xl tracking-tighter text-center font-regular">
              <span className="font-semibold">AI code review</span>
              <span className="mt-2 flex flex-wrap items-baseline justify-center gap-x-3 text-3xl text-muted-foreground md:text-5xl">
                <span>on every</span>
                <span className="relative inline-block whitespace-nowrap text-left font-semibold text-red-500">
                  {/* invisible sizer reserves the widest word's width + the baseline */}
                  <span className="invisible" aria-hidden="true">
                    {longestTitle}
                  </span>
                  {titles.map((title, index) => (
                    <motion.span
                      key={title}
                      className="absolute left-0 top-0 whitespace-nowrap"
                      initial={{ opacity: 0, y: 40 }}
                      transition={{ type: 'spring', stiffness: 50 }}
                      animate={
                        titleNumber === index
                          ? { y: 0, opacity: 1 }
                          : { y: titleNumber > index ? -40 : 40, opacity: 0 }
                      }
                    >
                      {title}
                    </motion.span>
                  ))}
                </span>
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-center text-lg leading-relaxed tracking-tight text-muted-foreground md:text-2xl">
              Bugs, leaked secrets, missing tests — caught before they merge.
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-xl">
            <p className="text-muted-foreground text-center">
              Add it to your repo in one command:
            </p>
            <ShellCommand command="npx shippie init" />
            <p className="text-sm text-muted-foreground text-center">
              Scaffolds a GitHub Action that reviews every pull request. Or run{' '}
              <code className="font-mono text-foreground">npx shippie review</code> to
              review your staged changes locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Hero }
