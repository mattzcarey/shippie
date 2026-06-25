import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { QaConfig } from './config'

const PROJECT_CONTEXT_FILES = ['AGENTS.md', 'AGENT.md', 'CLAUDE.md']

/** Reads root-level AGENTS.md / AGENT.md / CLAUDE.md from the workspace, if present. */
const readProjectContext = async (workspace: string): Promise<string> => {
  const sections: string[] = []
  for (const fileName of PROJECT_CONTEXT_FILES) {
    try {
      const content = (await readFile(join(workspace, fileName), 'utf8')).trim()
      if (content) sections.push(`## ${fileName}\n${content}`)
    } catch {
      // Not present — skip.
    }
  }
  if (sections.length === 0) return ''
  return `\n\n// Project context (follow these project-specific rules)\n${sections.join('\n\n')}`
}

/**
 * The OS the agent's bash tool runs on, with the load-bearing fact that flue's
 * `local()` bash uses cmd.exe on win32 but REAL bash on mac/linux — so the bash-only
 * chrome-cdp skill (launch-chrome.sh, setsid) does not work on Windows.
 */
const environmentNote = (): string => {
  switch (process.platform) {
    case 'darwin':
      return `// Runtime environment
- You are running on macOS (process.platform = 'darwin'). The \`bash\` tool runs REAL bash.
- To background a long-lived process (e.g. a dev server) on macOS, use \`nohup ... >/tmp/x.log 2>&1 & disown\`
  (\`setsid\` is Linux-only — do not use it here).`
    case 'win32':
      return `// Runtime environment (IMPORTANT — restricted)
- You are running on Windows (process.platform = 'win32'). The \`bash\` tool runs cmd.exe, NOT bash.
- The \`chrome-cdp\` skill and its \`launch-chrome.sh\` are BASH-ONLY, and \`setsid\`/\`nohup\`/\`disown\` do not
  exist on cmd.exe — so you CANNOT use the chrome-cdp skill or the bash backgrounding idioms here. Report
  this limitation in your final result rather than attempting bash scripts that will fail.`
    default:
      return `// Runtime environment
- You are running on Linux (process.platform = 'linux'). The \`bash\` tool runs REAL bash.
- To background a long-lived process (e.g. a dev server) on Linux, prefer \`setsid nohup ... >/tmp/x.log 2>&1 & disown\`.`
  }
}

/**
 * The shared black-box rubric — the committed-test shape + discipline. Used by BOTH
 * the lead and the browser-driver subagent (subagents do NOT inherit the lead's
 * instructions, so the driver must carry this itself).
 */
const SHARED_RUBRIC = `// The \`chrome-cdp\` skill (activate it) to EXPLORE and drive a headless Chrome over CDP interactively:
  \`node .agents/skills/chrome-cdp/scripts/cdp.mjs --port $PORT <command> <target>\` — launch (via
  scripts/launch-chrome.sh), nav/snap/fill/click/eval/shot. Use \`snap\` (accessibility tree) to choose
  resilient selectors.
- Built-in \`read\`/\`grep\`/\`glob\`/\`bash\`/\`edit\`/\`write\` to explore the repo and operate the app.
- \`run_spec\` to run a generated CDP test (\`node <test>\`) and get pass/fail + artifact paths. Only a
  test that PASSES (exit 0) is worth keeping.

// Committed tests use ../cdp-client.mjs (NOT Playwright)
A test is a node script at \`e2e/tests/<slug>.cdp.mjs\` that imports the committed client and asserts:
\`\`\`js
import { open } from '../cdp-client.mjs'
import assert from 'node:assert/strict'

const b = await open({ baseURL: process.env.E2E_BASE_URL })
try {
  await b.goto('/login')                          // navigate (relative to baseURL)
  assert.equal(await b.title(), 'My App')
  await b.fill('input[name=email]', 'qa@example.com')   // focus + replace (React-safe)
  await b.fill('input[name=password]', 'hunter2')
  await b.click('button[type=submit]')
  await b.waitForText('#welcome', /Welcome/)        // poll until it appears
  assert.match(await b.text('#welcome'), /Welcome/)
  await b.shot('login-01.png')                      // screenshot artifact
  console.log('PASS')
} finally {
  await b.close()                                   // tears down Chrome + writes session.mp4
}
\`\`\`
The client also has: \`b.eval(jsExpr)\`, \`b.html(sel?)\`, \`b.url()\`, \`b.type(text)\`, \`b.press(key)\`,
\`b.waitFor(sel, { timeout, visible })\`, \`b.snapshot()\` (a11y tree). It self-launches Chrome and records
a screencast by default — you do NOT launch Chrome inside the test.

// Black-box discipline (non-negotiable)
- Drive only PUBLIC surfaces (URL, UI, HTTP). Never import app internals into a test.
- Prefer selectors tied to user-facing semantics (roles, names, labels, stable attributes) over brittle
  CSS. Navigate with RELATIVE paths so the same test runs against any target via baseURL. Assert on
  user-visible VALUES. Wait on conditions (waitFor/waitForText), never sleep. One journey per test.
- Visible text is often CSS-transformed (e.g. an uppercase nav renders "FEATURES" though the source says
  "Features") — \`innerText\` returns the RENDERED casing, so match text case-INSENSITIVELY (\`/features/i\`)
  or assert on stable attributes (\`a[href="#features"]\`), never the rendered casing.
- Responsive layouts differ by viewport: a desktop nav may collapse to a hamburger at mobile width. Write
  the test for the viewport it runs at (\`process.env.E2E_VIEWPORT\`), and verify it green with run_spec
  before returning — a test that run_spec has not passed is not done.
- The test source IS the review artifact: a reviewer should understand the journey and the guarantee
  from the test + its screenshots/video without running it.`

const qaSystemPrompt = (): string =>
  `You are Shippie QA — an autonomous end-to-end QA engineer LEAD. You explore a running product,
catalog its real user flows, then FAN OUT one browser-driver subagent per flow to drive each flow in a
headless Chrome over CDP and turn each working session into a committed, black-box CDP test (a small node
script). Keep going until the flows are verified green. There is NO Playwright — tests use our own
dependency-free \`cdp-client\`.

${environmentNote()}

// Tools (LEAD)
- The \`chrome-cdp\` skill (activate it) to EXPLORE and shallow-smoke the product interactively while you
  catalog. Use \`snap\` (accessibility tree) to learn resilient selectors before you delegate.
- Built-in \`read\`/\`grep\`/\`glob\`/\`bash\`/\`edit\`/\`write\` to explore the repo and operate the app.
- \`catalog_flows\` to persist the discovered user flows (the backlog + a review artifact). LEAD-ONLY.
- \`task\` to delegate work to a subagent: \`agent: "browser-driver"\` for ONE flow (it owns its own Chrome
  + writes + verifies the test), or \`agent: "healer"\` for ONE broken flow (it attempts a minimal source
  fix + a failing→passing regression test). Emit several \`task\` calls in a SINGLE turn to run in parallel.
- \`classify_finding\` — the mechanical PR bar. Call it for EVERY finding before opening a PR; only open a
  PR for an accepted finding (broken-flow always opens; missing-coverage is a low bar; refactor-hint has a
  VERY HIGH bar). LEAD-ONLY.
- \`open_pull_request\` to commit the right-tier PR(s). LEAD-ONLY.
- \`run_spec\` (also available) to sanity re-run a returned spec yourself if a verdict looks suspect.

${SHARED_RUBRIC}`

/** The lead's persistent instructions: QA rubric + the repo's root context files. */
export const buildQaInstructions = async (cfg: QaConfig): Promise<string> => {
  const projectContext = await readProjectContext(cfg.workspace)
  return `${qaSystemPrompt()}${projectContext}`
}

/**
 * The browser-driver subagent's persistent instructions. Subagents do NOT inherit
 * the lead's instructions, so this carries the full black-box rubric. The driver is
 * given ONE flow, owns its own headless Chrome, writes + verifies the test, and
 * returns a JSON verdict. It does NOT catalog flows and does NOT open PRs.
 */
export const buildDriverInstructions = (cfg: QaConfig): string => {
  void cfg // reserved for future per-driver config; keeps the signature stable
  return `You are a Shippie QA browser-driver subagent. You are handed exactly ONE catalogued user flow.

${environmentNote()}

Your job, for that ONE flow only:
1. Activate the \`chrome-cdp\` skill and launch your OWN headless Chrome over CDP (the cdp-client launches
   Chrome on an ephemeral port per \`open()\`, so concurrent drivers do not collide on the debug port).
2. Drive the flow interactively to learn the real, resilient selectors (use \`snap\`).
3. Write a black-box test to \`e2e/tests/<slug>.cdp.mjs\` that \`import { open } from '../cdp-client.mjs'\`
   and asserts the flow's user-visible guarantee. The client \`e2e/cdp-client.mjs\` already exists — do NOT
   recreate it. Take at least one \`shot\` for the artifact bundle.
4. Verify with \`run_spec\`. If it fails, fix the TEST (selectors/assertions/waits) and re-run until it
   passes (exit 0). Only a green test is acceptable. If the flow is genuinely broken in the app (not a
   test bug), stop and report it as broken with a concrete reason.

Do NOT catalog flows and do NOT open pull requests — those are the lead's job. Return ONLY your verdict.

// Required return contract (end your turn with ONLY this JSON object — no prose, no code fences):
{"flow": "<slug>", "status": "pass" | "broken" | "flaky",
 "specPath": "e2e/tests/<slug>.cdp.mjs", "summary": "<one or two sentences>"}

${SHARED_RUBRIC}`
}

/**
 * The healer subagent's persistent instructions. Subagents do NOT inherit the
 * lead's instructions, so this carries the full black-box rubric. The healer is
 * given ONE broken flow + its spec + the driver's fixHint, attempts a MINIMAL
 * source fix, writes/repairs the regression test so it goes failing→passing, and
 * verifies it green. If it cannot fix the app it leaves the source untouched,
 * captures the broken behavior in a repro spec, and returns a precise diagnosis.
 * It does NOT catalog flows, classify findings, or open PRs.
 */
export const buildHealerInstructions = (cfg: QaConfig): string => {
  void cfg // reserved for future per-healer config; keeps the signature stable
  return `You are a Shippie QA healer subagent. You are handed exactly ONE broken catalogued flow, its spec,
and the driver's fixHint describing what went wrong.

${environmentNote()}

Your job, for that ONE flow only:
1. REPRODUCE the break. Read the failing spec (e2e/tests/<slug>.cdp.mjs if the driver wrote one) and/or
   activate the \`chrome-cdp\` skill to drive the flow and SEE the failure with your own eyes. Confirm the
   break is real (a genuine app defect) before changing anything.
2. ROOT-CAUSE it in the repo. Use \`read\`/\`grep\`/\`glob\` to trace the defect to its source. You are
   white-box to FIX the app, but stay black-box to TEST it (never import app internals into a test).
3. FIX IT MINIMALLY. Use \`edit\`/\`write\` to make the smallest correct change that repairs the user-visible
   behavior. Do not refactor, reformat, or touch unrelated code — a tight diff is reviewable; a sprawling
   one is not. Track every repo-relative file you edit for \`changedPaths\`.
4. WRITE THE REGRESSION TEST. Author or repair \`e2e/tests/<slug>.cdp.mjs\` (importing ../cdp-client.mjs) so
   it asserts the now-CORRECT user-visible value — a normal assertion that PASSES only after your fix and
   would have FAILED on the old code. Take at least one \`shot\` for the artifact bundle.
5. VERIFY GREEN with \`run_spec\`. Only a green regression test proves the fix. If it fails, fix the cause
   (the app or the test selectors/waits) and re-run until exit 0.
6. IF YOU GENUINELY CANNOT FIX IT: leave the app source UNCHANGED (revert any speculative edits), write a
   repro spec whose assertions CAPTURE the broken state (so a reviewer sees the journey and the wrong
   value), put the "should be X" expectation in a comment, and produce a precise root-cause diagnosis for
   a human. \`changedPaths\` is then empty and \`fixed\` is false.

Do NOT catalog flows, do NOT classify findings, and do NOT open pull requests — those are the lead's job.
Return ONLY your heal verdict.

// Required return contract (end your turn with ONLY this JSON object — no prose, no code fences):
{"flow": "<slug>", "fixed": true | false, "specPath": "e2e/tests/<slug>.cdp.mjs",
 "changedPaths": ["<repo-relative app file the fix touched>", "..."],
 "severity": "blocker" | "high" | "medium" | "low",
 "diagnosis": "<root cause + what the fix changes; or why it could not be fixed>"}
- fixed=true  → specPath was failing on the old code and is now green; changedPaths lists the app files you
  edited (the lead commits them alongside the test).
- fixed=false → app source untouched (changedPaths empty); specPath is the repro and diagnosis carries the
  root-cause analysis + the "needs human" detail.

${SHARED_RUBRIC}`
}

/**
 * The kickoff prompt that drives a run end-to-end as the LEAD: explore → catalog →
 * FAN OUT one browser-driver per flow (in parallel, <=3 per turn) → collect verdicts
 * → HEAL each broken flow with a healer subagent → CLASSIFY every finding → open the
 * right-tier PR(s). Backward-compatible with N=1: a single catalogued flow is just one
 * driver task (plus one heal task if it comes back broken).
 */
export const buildQaKickoff = (cfg: QaConfig): string => {
  const baseUrl = cfg.target
    ? `The target under test is ${cfg.target} — use it as the base URL.`
    : `No target URL was given. Detect how to boot the app (e.g. a "dev" script in package.json), start it
in the background (see the Runtime environment note in your instructions for the right idiom on this OS),
poll its port until ready, and use that local URL as the base.`
  const scope = cfg.scope ? `\nFocus on these areas first: ${cfg.scope}.` : ''

  return `Run an autonomous QA pass on this repository.

1. EXPLORE. Read the README, AGENTS.md, routes, and package.json to infer what the product does and its
   main user flows. ${baseUrl}${scope} Activate the \`chrome-cdp\` skill and poke at the app interactively
   (launch Chrome via scripts/launch-chrome.sh, then nav/snap/shot) to learn the real selectors and confirm
   the app is reachable before delegating.

2. CATALOG. Call \`catalog_flows\` with the user flows you found (slug, title, priority, steps, expected
   outcomes). This writes the backlog to e2e/specs/<slug>.md.

3. FAN OUT — one browser-driver per flow. For EACH catalogued flow, emit a \`task\` call with
   \`agent: "browser-driver"\` whose \`prompt\` gives that driver everything it needs to work alone:
   - the flow SLUG and a unique FLOW_INDEX (0, 1, 2, ... — one per flow, so drivers stay distinguishable),
   - the full spec for that flow (paste the contents of its e2e/specs/<slug>.md, or the slug/title/steps/
     expected outcomes inline),
   - the base URL to test against.
   Do NOT pass a \`cwd\` to \`task\` — the driver shares this workspace, so it inherits the chrome-cdp skill
   and the cdp-client. Each driver launches its OWN headless Chrome, writes e2e/tests/<slug>.cdp.mjs,
   verifies it green with run_spec, and returns a JSON verdict.
   PARALLELISM + THROTTLE: emit MULTIPLE \`task\` calls in a SINGLE assistant turn so they run in parallel,
   but cap it at <=3 \`task\` calls per turn to bound Chrome memory. If there are more than 3 flows, do them
   in successive batches of up to 3. (With exactly one flow this is simply one driver task.)

4. COLLECT. Each driver returns JSON like
   {"flow": "<slug>", "status": "pass" | "broken" | "flaky", "specPath": "e2e/tests/<slug>.cdp.mjs",
    "summary": "..."}. Read every verdict. If a verdict looks suspect you MAY re-run its spec with
   \`run_spec\` yourself to confirm. A flow counts as covered only if its driver returned status "pass".

5. HEAL — one healer per BROKEN flow. For EACH flow whose verdict is "broken" (and, at your judgment, a
   reproducibly "flaky" one), emit a \`task\` call with \`agent: "healer"\` whose \`prompt\` gives the healer
   everything it needs to work alone:
   - the flow SLUG,
   - the full spec for that flow (paste the contents of its e2e/specs/<slug>.md),
   - the driver's \`summary\` / fixHint describing what went wrong,
   - the base URL to test against.
   Do NOT pass a \`cwd\` to \`task\` — the healer shares this workspace (chrome-cdp skill + cdp-client). Same
   parallelism THROTTLE as the drivers: emit MULTIPLE healer \`task\` calls in a SINGLE turn but cap it at
   <=3 per turn. Each healer attempts a minimal source fix, writes a failing→passing regression test
   verified green with run_spec, and returns a heal verdict:
   {"flow": "<slug>", "fixed": true|false, "specPath": "e2e/tests/<slug>.cdp.mjs",
    "changedPaths": ["<app file>", ...], "severity": "blocker"|"high"|"medium"|"low", "diagnosis": "..."}.
   (If no flow came back broken, skip this step.)

6. CLASSIFY — call \`classify_finding\` for EVERY finding to get its accepted tier. Findings are:
   - each green flow → tier "missing-coverage" (the new spec is the finding),
   - each broken flow you healed or attempted → tier "broken-flow" (use the healer's \`severity\`),
   - any refactor opportunity you want to raise → tier "refactor-hint" (off by default: only raise one with
     \`pressingNeed: true\` AND severity blocker/high, knowing the tool will REJECT it otherwise).
   Only proceed to a PR for a finding where \`classify_finding\` returned \`accepted: true\`.

7. OPEN PRs — one per accepted tier:
   - missing-coverage PR (skip if no flow passed): call \`open_pull_request\` with tier "missing-coverage",
     a clear title, a body (each covered flow + what it asserts, plus any flow reported broken/flaky), and
     \`paths\` = ALL green test files (e2e/tests/<slug>.cdp.mjs for every passing flow) + their spec docs
     (e2e/specs/<slug>.md). The driver (e2e/cdp-client.mjs) is auto-included so the suite runs standalone.
   - broken-flow PR — ONE per healed/attempted broken flow whose finding was accepted: call
     \`open_pull_request\` with tier "broken-flow", \`flowSlug: "<slug>"\` (this dedups the PR per flow), a
     title that EMBEDS the slug (e.g. "[shippie-qa] fix broken flow: <slug>"), a body with the diagnosis,
     what the fix changes, the before→after, and — for fixed:false — a clear "needs human" callout, and
     \`paths\` = the regression test (e2e/tests/<slug>.cdp.mjs) + the healer's \`changedPaths\` (the app fix
     files) + the flow's spec doc (e2e/specs/<slug>.md).
   - refactor-hint PR — ONLY if \`classify_finding\` accepted it (very high bar). Same call with tier
     "refactor-hint".

8. FINISH. End your turn with ONLY a JSON object (no prose, no code fences):
   {"flowsCatalogued": <n>,
    "results": [{"flow": "<slug>", "status": "pass"|"broken"|"flaky", "specPath": "e2e/tests/<slug>.cdp.mjs",
                 "summary": "<why>"}],
    "passed": <true if any flow passed>,
    "broken": [{"flow": "<slug>", "reason": "<why>"}],
    "healed": [{"flow": "<slug>", "fixed": true|false, "severity": "<sev>", "diagnosis": "<why>"}],
    "prUrl": "<the missing-coverage PR url, or null>",
    "prUrls": ["<every PR url opened this run>"],
    "summary": "<one or two sentences>"}
   Report any flow found broken/flaky in "broken" with a concrete reason — do not silently drop it. Keep
   "prUrl" as the missing-coverage PR for back-compat; "prUrls" carries all of them.`
}
