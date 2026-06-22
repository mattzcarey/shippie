#!/usr/bin/env node
/**
 * shippie CLI.
 *
 * `shippie review` runs the prebuilt review workflow against the current
 * directory. It boots the bundled flue server (dist/server.mjs) on a local
 * port, invokes POST /workflows/review once, prints the JSON result, and exits.
 * Locally (platform "local") it reviews your STAGED diff (`git add` first).
 *
 * Config is read from the environment (same vars as the GitHub Action):
 *   SHIPPIE_MODEL, SHIPPIE_REVIEW_LANGUAGE, SHIPPIE_THINKING_LEVEL,
 *   SHIPPIE_IGNORE, SHIPPIE_CUSTOM_INSTRUCTIONS, SHIPPIE_MCP_SERVERS,
 *   SHIPPIE_TELEMETRY, plus the provider key (ANTHROPIC_API_KEY, OPENAI_API_KEY,
 *   OPENROUTER_API_KEY, or CLOUDFLARE_API_KEY + CLOUDFLARE_ACCOUNT_ID).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)))

const HELP = `shippie — an extensible code review agent (built on flue)

Usage:
  shippie review     Review the current repo (local = staged diff; CI = the PR)
  shippie init       Scaffold a GitHub Actions workflow that runs Shippie on PRs
  shippie configure  Deprecated alias for "init" (removed in the next major version)

Set a model + provider key first, e.g.:
  export ANTHROPIC_API_KEY=...   # with SHIPPIE_MODEL=anthropic/claude-sonnet-4-6 (default)
`

const WORKFLOW_TEMPLATE = `name: Shippie 🚢

on:
  pull_request:

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: mattzcarey/shippie@v0
        with:
          MODEL: anthropic/claude-sonnet-4-6
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`

const [command = 'review'] = process.argv.slice(2)

if (command === '-h' || command === '--help' || command === 'help') {
  process.stdout.write(HELP)
  process.exit(0)
}

if (command === 'init' || command === 'configure') {
  if (command === 'configure') {
    process.stderr.write(
      'shippie: "configure" is deprecated and will be removed in the next major version. Use "shippie init".\n'
    )
  }
  const force = process.argv.includes('--force')
  const workflowDir = join(process.cwd(), '.github', 'workflows')
  const workflowPath = join(workflowDir, 'shippie.yml')
  if (existsSync(workflowPath) && !force) {
    process.stderr.write(
      `shippie: ${relative(process.cwd(), workflowPath)} already exists. Re-run with --force to overwrite.\n`
    )
    process.exit(1)
  }
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(workflowPath, WORKFLOW_TEMPLATE)
  process.stdout.write(
    `Created ${relative(process.cwd(), workflowPath)}\n\n` +
      'Next steps:\n' +
      '  1. Add a provider API key as a repo secret (Settings → Secrets and variables → Actions),\n' +
      '     e.g. ANTHROPIC_API_KEY — or edit the workflow to use OPENAI_API_KEY / Cloudflare.\n' +
      '  2. Open a pull request; Shippie will review it.\n\n' +
      'Run reviews locally with: shippie review\n'
  )
  process.exit(0)
}

if (command !== 'review') {
  process.stderr.write(`shippie: unknown command "${command}"\n\n${HELP}`)
  process.exit(1)
}

const serverPath = join(pkgRoot, 'dist', 'server.mjs')
if (!existsSync(serverPath)) {
  process.stderr.write(
    'shippie: build artifact dist/server.mjs not found. Run "npm run build" first (or reinstall shippie).\n'
  )
  process.exit(1)
}

const port = 1024 + Math.floor(Math.random() * 60000)
const base = `http://127.0.0.1:${port}`
const platform = process.env.GITHUB_ACTIONS ? 'github' : 'local'
const payload = JSON.stringify({ platform, workspace: process.cwd() })

const server = spawn(process.execPath, [serverPath], {
  env: { ...process.env, PORT: String(port) },
  // Keep our stdout clean for the JSON result; let the server log to stderr.
  stdio: ['ignore', 'ignore', 'inherit'],
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const waitForServer = async () => {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base, { signal: AbortSignal.timeout(1000) })
      return
    } catch {
      await sleep(150)
    }
  }
  throw new Error('shippie: server did not start in time')
}

const shutdown = () => {
  try {
    server.kill('SIGTERM')
  } catch {}
}

try {
  await waitForServer()
  const res = await fetch(`${base}/workflows/review?wait=result`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
  })
  const text = await res.text()
  shutdown()
  try {
    const parsed = JSON.parse(text)
    // Unwrap the `?wait=result` envelope ({ result, runId, ... }) to the workflow result.
    const out =
      parsed && typeof parsed === 'object' && 'result' in parsed ? parsed.result : parsed
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } catch {
    process.stdout.write(`${text}\n`)
  }
  process.exit(res.ok ? 0 : 1)
} catch (error) {
  shutdown()
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
