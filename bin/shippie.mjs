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
                     (--cross-os: verify the committed tests on ubuntu + windows + macos)
  shippie qa fanout-init [owner/repoA,owner/repoB ...]
                     Scaffold a control-repo workflow that fans QA out across many repos
                     you own (dispatches each target's own shippie-qa.yml via a GitHub App)
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

// The "verify" job re-runs the committed CDP tests with plain node + system Chrome.
// Default = ubuntu-only. With --cross-os it fans out to a 3-OS matrix (ubuntu +
// windows + macos), installing Chrome + ffmpeg per-OS and uploading per-OS artifacts.
const buildVerifyJob = (crossOs) => {
  const runsOn = crossOs
    ? `    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: \${{ matrix.os }}`
    : `    runs-on: ubuntu-latest`

  const ffmpeg = crossOs
    ? `      # ffmpeg (screencast → mp4): per-OS package manager.
      - name: Install ffmpeg (Linux)
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y ffmpeg
      - name: Install ffmpeg (macOS)
        if: runner.os == 'macOS'
        run: brew install ffmpeg
      - name: Install ffmpeg (Windows)
        if: runner.os == 'Windows'
        run: choco install ffmpeg -y --no-progress`
    : `      - name: Install ffmpeg (screencast → mp4)
        run: sudo apt-get update && sudo apt-get install -y ffmpeg`

  // On windows-latest the default shell is PowerShell; the array/nullglob/shopt
  // script is bash-only, so pin shell: bash (Git Bash ships on the windows runner).
  const testShell = crossOs ? `        shell: bash\n` : ``
  const artifactName = crossOs ? `e2e-artifacts-\${{ matrix.os }}` : `e2e-artifacts`

  return `  verify:
    needs: author
    if: needs.author.outputs.changed == 'true'
${runsOn}
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
      - uses: browser-actions/setup-chrome@v1
        id: chrome
${ffmpeg}
      - name: Run committed CDP e2e tests (node + Chrome; no deps)
${testShell}        env:
          E2E_BASE_URL: \${{ needs.author.outputs.base_url }}
          CHROME_BIN: \${{ steps.chrome.outputs.chrome-path }}
          CDP_IGNORE_CERT_ERRORS: "1"
        run: |
          shopt -s nullglob
          tests=(e2e/tests/*.mjs)
          if [ \${#tests[@]} -eq 0 ]; then echo "No e2e/tests/*.mjs found"; exit 1; fi
          fail=0
          for f in "\${tests[@]}"; do
            echo "== $f =="
            node "$f" || fail=1
          done
          exit $fail
      - if: \${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: ${artifactName}
          path: e2e/.artifacts/
          retention-days: 30
`
}

// Weekly + on-demand autonomous QA. The "author" job runs the agent (Linux, holds
// the model key) and opens a PR; the "verify" job re-runs the committed CDP tests
// (no agent, no key) so the PR's checks prove them green.
const buildQaWorkflow = ({ crossOs } = {}) => `name: Shippie QA 🧪

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
      base_url: \${{ steps.qa.outputs.base_url }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: qa
        uses: mattzcarey/shippie/qa@v0
        with:
          MODEL: \${{ inputs.model || 'anthropic/claude-opus-4-8' }}
          # On the weekly cron inputs.target is empty — set the SHIPPIE_QA_TARGET repo
          # variable (Settings → Secrets and variables → Actions → Variables) to the URL
          # to QA, or pass -f target=... on workflow_dispatch.
          TARGET: \${{ inputs.target || vars.SHIPPIE_QA_TARGET }}
          SCOPE: \${{ inputs.scope }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

${buildVerifyJob(crossOs)}`

// Cross-repo fan-out. Scaffolded into a *control* repo: on a schedule + on demand
// it dispatches each TARGET repo's own .github/workflows/shippie-qa.yml. It never
// pushes or opens PRs in the targets — each target runs under its OWN GITHUB_TOKEN.
// The cross-repo credential is a GitHub App installation token (actions/create-
// github-app-token@v1) scoped per-shard to a single repo with actions:write only,
// because dispatching a workflow is all the "create a workflow dispatch event" REST
// call needs. GITHUB_TOKEN is repo-scoped and CANNOT dispatch other repos.
const buildFanoutWorkflow = (repos) => {
  const matrix = (repos.length > 0 ? repos : []).map((r) => `          - ${r}`).join('\n')
  const matrixBlock =
    repos.length > 0
      ? matrix
      : `          # >>> Fill in the target repos (owner/repo), one per line. <<<
          # Re-run: shippie qa fanout-init owner/repoA,owner/repoB
          # - my-org/app-one
          # - my-org/app-two`

  return `name: Shippie QA — fan-out 🚢🧪

# Runs Shippie QA across many repos you own from this single control repo.
# Each target repo runs its OWN .github/workflows/shippie-qa.yml under its own
# GITHUB_TOKEN — this workflow only DISPATCHES them (actions:write), it never
# pushes or opens PRs in the targets.

on:
  schedule:
    - cron: "0 6 * * 1" # Mondays 06:00 UTC
  workflow_dispatch:
    inputs:
      target:
        description: "Optional URL/path passed through to each repo's QA run (sets E2E_BASE_URL)"
        required: false
      scope:
        description: "Optional flows/areas to prioritize, passed through to each repo"
        required: false

# This workflow itself needs NO write scope on the control repo: the cross-repo
# credential is the App token minted below, not GITHUB_TOKEN.
permissions:
  contents: read

concurrency:
  group: shippie-qa-fanout
  cancel-in-progress: false

jobs:
  dispatch:
    runs-on: ubuntu-latest
    strategy:
      # Don't let one un-installed / mis-scaffolded repo abort the rest.
      fail-fast: false
      max-parallel: 4
      matrix:
        repo:
${matrixBlock}
    steps:
      - name: Mint an App installation token scoped to this target (actions:write only)
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: \${{ vars.QA_APP_ID }}
          private-key: \${{ secrets.QA_APP_PRIVATE_KEY }}
          # owner is required when "repositories" names a repo outside this control repo.
          owner: \${{ github.repository_owner }}
          repositories: \${{ matrix.repo }}
          # Least privilege: dispatching a workflow only needs actions:write.
          # The TARGET's own run uses ITS OWN GITHUB_TOKEN to push specs + open the PR,
          # so this token needs NO contents / pull-requests on the target.
          permission-actions: write

      - name: Dispatch shippie-qa.yml in \${{ matrix.repo }}
        env:
          GH_TOKEN: \${{ steps.app-token.outputs.token }}
        run: |
          extra=()
          [ -n "\${{ inputs.target }}" ] && extra+=(-f "target=\${{ inputs.target }}")
          [ -n "\${{ inputs.scope }}" ]  && extra+=(-f "scope=\${{ inputs.scope }}")
          gh workflow run shippie-qa.yml \\
            --repo "\${{ matrix.repo }}" \\
            --ref  "$(gh repo view "\${{ matrix.repo }}" --json defaultBranchRef -q .defaultBranchRef.name)" \\
            "\${extra[@]}"
          echo "Dispatched shippie-qa.yml in \${{ matrix.repo }}"
`
}

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
  const crossOs = process.argv.includes('--cross-os')
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'shippie-qa.yml')
  if (existsSync(workflowPath) && !force) {
    process.stderr.write(
      `shippie: ${relative(process.cwd(), workflowPath)} already exists. Re-run with --force to overwrite.\n`
    )
    process.exit(1)
  }
  mkdirSync(dirname(workflowPath), { recursive: true })
  writeFileSync(workflowPath, buildQaWorkflow({ crossOs }))
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
  writeFileSync(workflowPath, buildFanoutWorkflow(repos))
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
