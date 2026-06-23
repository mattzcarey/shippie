import { ArrowRight, GithubLogo, SealCheck } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { ShellCommand } from './ShellCommand'

const GITHUB_REPO = 'https://github.com/mattzcarey/shippie'

const Hero = () => {
  const [titleNumber, setTitleNumber] = useState(0)
  const titles = useMemo(
    () => ['vibe coders', 'hackers', 'builders', 'shippers', 'indie devs'],
    []
  )
  // Reserve space for the widest word so the line never reflows as it rotates.
  const longestTitle = useMemo(
    () => titles.reduce((a, b) => (b.length >= a.length ? b : a), ''),
    [titles]
  )

  useEffect(() => {
    const id = setInterval(() => setTitleNumber((n) => (n + 1) % titles.length), 2200)
    return () => clearInterval(id)
  }, [titles])

  return (
    <section className="relative w-full overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center pt-28 pb-20 text-center md:pt-36 lg:pb-28">
          {/* manifest eyebrow */}
          <motion.a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="group mb-9 inline-flex items-center gap-2.5 border border-border bg-card/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur transition-colors hover:border-signal/40 hover:text-foreground"
          >
            <span className="text-signal">●</span>
            Open source
            <span className="text-border">/</span>
            <GithubLogo size={13} weight="fill" />
            mattzcarey/shippie
            <ArrowRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </motion.a>

          {/* headline + inspection stamp */}
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 1.5, rotate: -24 }}
              animate={{ opacity: 1, scale: 1, rotate: -11 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 130, damping: 11 }}
              className="pointer-events-none absolute -top-12 right-0 hidden select-none md:block lg:-right-20"
            >
              <div className="flex items-center gap-2 border-2 border-signal/70 px-3 py-1.5 text-signal shadow-[inset_0_0_0_2px_rgba(255,74,28,0.18)]">
                <SealCheck size={18} weight="bold" />
                <span className="font-mono text-xs font-bold uppercase tracking-[0.18em]">
                  Cleared to merge
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="font-display text-[clamp(3rem,10vw,8rem)] font-extrabold uppercase leading-[0.84] tracking-tight"
            >
              <span className="block bg-gradient-to-b from-foreground to-foreground/55 bg-clip-text text-transparent">
                Code review for
              </span>
              <span className="mt-1 flex justify-center text-signal">
                <span className="relative inline-block whitespace-nowrap text-left">
                  {/* invisible sizer reserves the widest word's width + the baseline */}
                  <span className="invisible" aria-hidden="true">
                    {longestTitle}
                  </span>
                  {titles.map((title, index) => (
                    <motion.span
                      key={title}
                      className="absolute left-0 top-0 whitespace-nowrap"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 60, damping: 12 }}
                      animate={
                        titleNumber === index
                          ? { y: 0, opacity: 1 }
                          : { y: titleNumber > index ? -30 : 30, opacity: 0 }
                      }
                    >
                      {title}
                    </motion.span>
                  ))}
                </span>
              </span>
            </motion.h1>
          </div>

          {/* subhead — what it does */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-8 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl"
          >
            Bugs, leaked secrets, missing tests —{' '}
            <span className="text-foreground">caught before they merge.</span>
          </motion.p>

          {/* install command */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 flex w-full max-w-xl flex-col items-center gap-3"
          >
            <ShellCommand command="npx shippie init" />
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
              Scaffolds a GitHub Action · or{' '}
              <span className="text-foreground/80">npx shippie review</span> locally
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export { Hero }
