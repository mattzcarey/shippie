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
              <span className="block text-muted-foreground text-3xl md:text-5xl mt-2">
                on every{' '}
                <span className="relative inline-flex h-[1.3em] min-w-[7ch] justify-center text-center align-bottom">
                  {titles.map((title, index) => (
                    <motion.span
                      key={title}
                      className="absolute font-semibold text-red-500 whitespace-nowrap"
                      initial={{ opacity: 0, y: '-100' }}
                      transition={{ type: 'spring', stiffness: 50 }}
                      animate={
                        titleNumber === index
                          ? {
                              y: 0,
                              opacity: 1,
                            }
                          : {
                              y: titleNumber > index ? -150 : 150,
                              opacity: 0,
                            }
                      }
                    >
                      {title}
                    </motion.span>
                  ))}
                </span>
              </span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center mt-4">
              Shippie is an extendable, open-source code review agent. It reads your
              diff, explores the codebase with real developer tools, and posts focused
              inline review comments — catching the bugs, secrets, and missing tests a
              human reviewer would.
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
