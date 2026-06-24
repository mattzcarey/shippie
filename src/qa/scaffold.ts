import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Starter Playwright config: ONE baseURL from `E2E_BASE_URL` (the dispatch
 * `target`), so the same spec runs against any environment (dev / production /
 * another repo's deploy) just by changing the env var. trace/video are ON so the
 * artifacts ARE the product. This is a fallback for repos with NO Playwright
 * setup — never a clobber (see `ensurePlaywrightConfig`).
 */
export const DEFAULT_PLAYWRIGHT_CONFIG = `import { defineConfig, devices } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/.artifacts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
    ['json', { outputFile: 'e2e/report/results.json' }],
    ['list'],
  ],
  use: { trace: 'on', video: 'on', screenshot: 'on', baseURL: BASE },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer:
    process.env.E2E_START_SERVER === '1'
      ? {
          command: 'npm run dev',
          url: BASE,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
})
`

/**
 * Write the starter Playwright config into the workspace ONLY if the repo has no
 * Playwright config already. Returns whether a file was written. Never clobbers a
 * target repo's own config — the agent then writes specs into the existing setup.
 */
export const ensurePlaywrightConfig = async (workspace: string): Promise<boolean> => {
  const existing = [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mjs',
  ]
  if (existing.some((f) => existsSync(join(workspace, f)))) return false
  await writeFile(join(workspace, 'playwright.config.ts'), DEFAULT_PLAYWRIGHT_CONFIG)
  return true
}
