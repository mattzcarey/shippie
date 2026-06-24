#!/usr/bin/env node
/**
 * shippie CLI.
 *
 * `shippie review` runs the prebuilt review workflow against the current directory
 * (local = STAGED diff; CI = the PR). `shippie qa` runs the autonomous QA workflow
 * (explore → catalog flows → drive in headless Chrome over CDP → write+verify a
 * CDP test → open a missing-coverage PR). Both boot the bundled flue server
 * (dist/server.mjs) on a local port, POST the workflow once, print the JSON result,
 * and exit.
 *
 * `shippie init` / `shippie qa init` scaffold the GitHub Actions workflows.
 *
 * Config is read from the environment (same vars as the GitHub Action):
 *   review: SHIPPIE_MODEL, SHIPPIE_REVIEW_LANGUAGE, SHIPPIE_THINKING_LEVEL, …
 *   qa:     SHIPPIE_QA_MODEL, SHIPPIE_QA_TARGET, SHIPPIE_QA_SCOPE, CHROME_BIN, …
 *   plus the provider key (ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY /
 *   CLOUDFLARE_API_KEY + CLOUDFLARE_ACCOUNT_ID) and GITHUB_TOKEN.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)))

const HELP = `shippie — an extensible code review + QA agent (built on flue)

Usage:
  shippie review     Review the current repo (local = staged diff; CI = the PR)
  shippie qa         Autonomous QA: explore, drive flows in headless Chrome, write+verify e2e tests
  shippie init       Scaffold a GitHub Actions workflow that reviews every pull request
  shippie qa init    Scaffold a weekly + on-demand QA workflow (+ e2e/.gitignore)
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

const QA_WORKFLOW_TEMPLATE = `name: Shippie QA 🧪

# Weekly + on-demand autonomous QA. The "author" job runs the agent (Linux, holds
# the model key) and opens a PR; the "verify" job re-runs the committed CDP tests
# with plain node + system Chrome (no agent, no key) so the PR's checks prove them green.

on:
  schedule:
    - cron: "0 6 * * 1" # Mondays 06:00 UTC
  workflow_dispatch:
    inputs:
      target:
        description: "URL/path to QA (sets E2E_BASE_URL)"
        required: false
      scope:
        description: "Flows/areas to prioritize"
        required: false
      model:
        description: "Flue model"
        required: false
        default: "anthropic/claude-opus-4-8"

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: shippie-qa
  cancel-in-progress: false

jobs:
  author:
    runs-on: ubuntu-latest
    timeout-minutes: 90
    outputs:
      branch: \${{ steps.qa.outputs.branch }}
      changed: \${{ steps.qa.outputs.changed }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: qa
        uses: mattzcarey/shippie/qa@v0
        with:
          MODEL: \${{ inputs.model || 'anthropic/claude-opus-4-8' }}
          TARGET: \${{ inputs.target }}
          SCOPE: \${{ inputs.scope }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

  verify:
    needs: author
    if: needs.author.outputs.changed == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ needs.author.outputs.branch }}
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Run committed CDP e2e tests (node + system Chrome; no deps)
        env:
          E2E_BASE_URL: \${{ inputs.target }}
          CDP_IGNORE_CERT_ERRORS: "1"
        run: |
          shopt -s nullglob
          fail=0
          for f in e2e/tests/*.cdp.mjs; do
            echo "== $f =="
            node "$f" || fail=1
          done
          exit $fail
      - if: \${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: e2e-artifacts
          path: e2e/.artifacts/
          retention-days: 30
`

const writeIfAbsent = (path, content, label) => {
  if (existsSync(path)) {
    process.stdout.write(
      `  • ${label} already exists — left unchanged (${relative(process.cwd(), path)})\n`
    )
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  process.stdout.write(`  • wrote ${relative(process.cwd(), path)}\n`)
}

const [command = 'review', sub] = process.argv.slice(2)

if (command === '-h' || command === '--help' || command === 'help') {
  process.stdout.write(HELP)
  process.exit(0)
}

// `shippie init` / `shippie configure` — scaffold the review workflow.
if (command === 'init' || command === 'configure') {
  if (command === 'configure') {
    process.stderr.write(
      'shippie: "configure" is deprecated and will be removed in the next major version. Use "shippie init".\n'
    )
  }
  const force = process.argv.includes('--force')
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'shippie.yml')
  if (existsSync(workflowPath) && !force) {
    process.stderr.write(
      `shippie: ${relative(process.cwd(), workflowPath)} already exists. Re-run with --force to overwrite.\n`
    )
    process.exit(1)
  }
  mkdirSync(dirname(workflowPath), { recursive: true })
  writeFileSync(workflowPath, WORKFLOW_TEMPLATE)
  process.stdout.write(
    `Created ${relative(process.cwd(), workflowPath)}

Next steps:
  1. Add a provider API key as a repo secret (Settings → Secrets and variables → Actions),
     e.g. ANTHROPIC_API_KEY — or edit the workflow to use OPENAI_API_KEY / Cloudflare.
  2. Open a pull request; Shippie will review it.

Run reviews locally with: shippie review
`
  )
  process.exit(0)
}

// `shippie qa init` — scaffold the QA workflow + e2e/.gitignore.
if (command === 'qa' && sub === 'init') {
  const force = process.argv.includes('--force')
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'shippie-qa.yml')
  if (existsSync(workflowPath) && !force) {
    process.stderr.write(
      `shippie: ${relative(process.cwd(), workflowPath)} already exists. Re-run with --force to overwrite.\n`
    )
    process.exit(1)
  }
  mkdirSync(dirname(workflowPath), { recursive: true })
  writeFileSync(workflowPath, QA_WORKFLOW_TEMPLATE)
  process.stdout.write(`Created ${relative(process.cwd(), workflowPath)}\n`)
  writeIfAbsent(
    join(process.cwd(), 'e2e', '.gitignore'),
    '.artifacts/\n',
    'e2e/.gitignore'
  )
  process.stdout.write(
    `
Next steps:
  1. Add a model provider key as a repo secret, e.g. ANTHROPIC_API_KEY.
  2. Allow Actions to open PRs: Settings → Actions → General →
     "Allow GitHub Actions to create and approve pull requests".
  3. Run on demand:  gh workflow run shippie-qa.yml -f target=https://your-app.example.com

Shippie QA writes dependency-free CDP tests (e2e/tests/*.cdp.mjs + e2e/cdp-client.mjs) that run with
just node + Chrome — no Playwright. Run a pass locally with: shippie qa  (set SHIPPIE_QA_TARGET).
`
  )
  process.exit(0)
}

if (command !== 'review' && command !== 'qa') {
  process.stderr.write(`shippie: unknown command "${command}"\n\n${HELP}`)
  process.exit(1)
}

// `shippie review` / `shippie qa` — boot the bundled server and POST the workflow.
const workflow = command === 'qa' ? 'qa' : 'review'

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
  const res = await fetch(`${base}/workflows/${workflow}?wait=result`, {
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
