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
import {
  renderFanoutWorkflow,
  renderQaWorkflow,
  renderReviewWorkflow,
} from './templates.mjs'

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)))

const HELP = `shippie — an extensible code review + QA agent (built on flue)

Usage:
  shippie review     Review the current repo (local = staged diff; CI = the PR)
  shippie qa         Autonomous QA: explore, drive flows in headless Chrome, write+verify e2e tests
  shippie init       Scaffold a GitHub Actions workflow that reviews every pull request
  shippie qa init    Scaffold a weekly + on-demand QA workflow (+ e2e/.gitignore)
                     (--cross-os: verify the committed tests on ubuntu + windows + macos)
  shippie qa fanout-init [owner/repoA,owner/repoB ...]
                     Scaffold a control-repo workflow that fans QA out across many repos
                     you own (dispatches each target's own shippie-qa.yml via a GitHub App)
  shippie configure  Deprecated alias for "init" (removed in the next major version)

Set a model + provider key first, e.g.:
  export ANTHROPIC_API_KEY=...   # with SHIPPIE_MODEL=anthropic/claude-sonnet-4-6 (default)
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
  writeFileSync(workflowPath, renderReviewWorkflow())
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
  const crossOs = process.argv.includes('--cross-os')
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'shippie-qa.yml')
  if (existsSync(workflowPath) && !force) {
    process.stderr.write(
      `shippie: ${relative(process.cwd(), workflowPath)} already exists. Re-run with --force to overwrite.\n`
    )
    process.exit(1)
  }
  mkdirSync(dirname(workflowPath), { recursive: true })
  writeFileSync(workflowPath, renderQaWorkflow({ crossOs }))
  process.stdout.write(`Created ${relative(process.cwd(), workflowPath)}\n`)
  if (crossOs) {
    process.stdout.write(
      '  • verify job runs on a 3-OS matrix (ubuntu + windows + macos)\n'
    )
  }
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

Shippie QA writes dependency-free tests that run with just node: web targets → e2e/tests/*.cdp.mjs (+
e2e/cdp-client.mjs, drives Chrome over CDP, no Playwright); CLI/lib targets → e2e/tests/*.cli.mjs (+
e2e/cli-client.mjs). Run a pass locally with: shippie qa  (SHIPPIE_QA_TARGET for web; SHIPPIE_QA_KIND=cli
for a CLI/lib target). Pass --cross-os to verify the committed tests on ubuntu + windows + macos.
`
  )
  process.exit(0)
}

// `shippie qa fanout-init [owner/repoA,owner/repoB ...]` — scaffold the cross-repo
// fan-out workflow into the CURRENT (control) repo. Accepts the target list as
// comma-separated and/or space-separated args; flags are ignored.
if (command === 'qa' && sub === 'fanout-init') {
  const force = process.argv.includes('--force')
  // Everything after "qa fanout-init" that isn't a flag is a repo (comma- or
  // space-separated). e.g. "owner/a,owner/b owner/c" → [owner/a, owner/b, owner/c].
  const repos = process.argv
    .slice(4)
    .filter((a) => !a.startsWith('-'))
    .flatMap((a) => a.split(','))
    .map((r) => r.trim())
    .filter(Boolean)

  const workflowPath = join(
    process.cwd(),
    '.github',
    'workflows',
    'shippie-qa-fanout.yml'
  )
  if (existsSync(workflowPath) && !force) {
    process.stderr.write(
      `shippie: ${relative(process.cwd(), workflowPath)} already exists. Re-run with --force to overwrite.\n`
    )
    process.exit(1)
  }
  mkdirSync(dirname(workflowPath), { recursive: true })
  writeFileSync(workflowPath, renderFanoutWorkflow(repos))
  process.stdout.write(
    `Created ${relative(process.cwd(), workflowPath)}` +
      (repos.length > 0
        ? `  (${repos.length} target repo${repos.length === 1 ? '' : 's'})\n`
        : `  (no target repos yet — edit the matrix to add them)\n`)
  )

  if (repos.length === 0) {
    process.stdout.write(
      '  • no repos given — wrote a commented placeholder matrix; fill in the\n' +
        '    target repos (owner/repo) in the file, or re-run:\n' +
        '      shippie qa fanout-init owner/repoA,owner/repoB\n'
    )
  }

  process.stdout.write(
    `
This control workflow DISPATCHES each target repo's own shippie-qa.yml. It does
NOT push or open PRs in the targets — each target runs under its OWN GITHUB_TOKEN.

Set up the GitHub App (one-time):
  1. Create a GitHub App (Settings → Developer settings → GitHub Apps → New).
     Permissions → Repository → Actions: Read and write.  (nothing else is needed)
  2. Generate a private key; install the App on EVERY target repo above.
  3. In THIS control repo: add the App ID as a repo *variable* QA_APP_ID
     (Settings → Secrets and variables → Actions → Variables), and the private
     key as a repo *secret* QA_APP_PRIVATE_KEY.

In EACH target repo (one-time):
  4. Ensure it has .github/workflows/shippie-qa.yml  (run \`shippie qa init\` there,
     commit, push to its default branch — the dispatch targets the default branch).
  5. Add its model provider key as a repo secret, e.g. ANTHROPIC_API_KEY.
  6. Settings → Actions → General → "Allow GitHub Actions to create and approve
     pull requests"  (without this the target's own QA run can't open its PR).

Then:
  • Scheduled:  runs every Monday 06:00 UTC.
  • On demand:  gh workflow run shippie-qa-fanout.yml
                gh workflow run shippie-qa-fanout.yml -f scope="checkout + login"

Edit the matrix in ${relative(process.cwd(), workflowPath)} to add/remove repos.
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
