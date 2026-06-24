import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Locate the bundled chrome-cdp skill source. Works both in dev (running from
 * `src/qa/skill.ts`, so `../skills`) and from the built artifact (running from
 * `dist/server.mjs`, so `../src/skills`, since `files` ships `src/skills`).
 */
const findSkillSrc = (): string => {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, '..', 'skills', 'chrome-cdp'), // dev: src/qa → src/skills
    join(here, '..', '..', 'src', 'skills', 'chrome-cdp'), // built: dist → <root>/src/skills
    join(here, '..', 'src', 'skills', 'chrome-cdp'),
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'SKILL.md'))) return c
  }
  throw new Error(
    `chrome-cdp skill source not found (looked in: ${candidates.join(', ')})`
  )
}

/**
 * Copy the chrome-cdp skill into `<workspace>/.agents/skills/chrome-cdp` so flue
 * auto-discovers it and the agent's relative
 * `node .agents/skills/chrome-cdp/scripts/cdp.mjs` paths resolve. A plain copy of
 * a dependency-free script — zero build-pipeline risk. The agent never commits
 * `.agents/` (open_pull_request commits only the explicit spec paths).
 */
export const materializeSkill = async (workspace: string): Promise<void> => {
  const dest = join(workspace, '.agents', 'skills', 'chrome-cdp')
  await mkdir(dest, { recursive: true })
  await cp(findSkillSrc(), dest, { recursive: true })
}

/**
 * Copy the dependency-free cdp-client into `<workspace>/e2e/cdp-client.mjs` — the
 * driver that committed CDP tests import as `../cdp-client.mjs`. It is committed
 * alongside the tests so the suite runs with just `node` (no install), in CI or
 * locally. (The agent's interactive CLI lives separately under .agents/skills.)
 */
export const materializeClient = async (workspace: string): Promise<void> => {
  const src = join(findSkillSrc(), 'scripts', 'cdp-client.mjs')
  const dest = join(workspace, 'e2e', 'cdp-client.mjs')
  await mkdir(dirname(dest), { recursive: true })
  await cp(src, dest)
}
