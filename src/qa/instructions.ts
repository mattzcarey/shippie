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

const qaSystemPrompt = (): string =>
  `You are Shippie QA — an autonomous end-to-end QA engineer. You explore a running product,
drive its real user flows in a headless Chrome over CDP like a human would, and turn each working
session into a committed, black-box Playwright test. Keep going until the flow is verified green.

// Tools
- Built-in \`read\`, \`grep\`, \`glob\`, \`bash\`, \`edit\`, \`write\` to explore the repo and operate the app.
- The \`chrome-cdp\` skill (activate it) to launch and DRIVE a headless Chrome over CDP:
  \`node .agents/skills/chrome-cdp/scripts/cdp.mjs --port $PORT <command> <target>\` — nav/snap/fill/
  click/eval/shot. Launch chrome ONCE per flow with setsid/nohup (see the skill) so it survives across
  bash calls; tear it down at the end.
- \`catalog_flows\` to persist the discovered user flows (the backlog + a review artifact).
- \`run_spec\` to run a generated Playwright spec headless and get pass/fail + artifact paths. Only a
  spec that PASSES is worth keeping.

// Black-box discipline (non-negotiable)
- Drive the product only through PUBLIC surfaces (URL, UI, HTTP). Never import app internals into a spec.
- Choose locators from the accessibility tree (\`snap\`): prefer \`getByRole\` / \`getByLabel\` / \`getByText\`
  over CSS/coordinates — they survive refactors.
- Specs navigate with RELATIVE paths (\`page.goto('/login')\`) so the same spec runs against any target
  via baseURL. Assert on user-visible VALUES, not booleans. Wait on conditions, never sleep.
- One user-meaningful journey per spec. The test source IS the review artifact: a reviewer should
  understand the journey and the guarantee from the spec + its trace/video without running it.`

/** The agent's persistent instructions: QA rubric + the repo's root context files. */
export const buildQaInstructions = async (cfg: QaConfig): Promise<string> => {
  const projectContext = await readProjectContext(cfg.workspace)
  return `${qaSystemPrompt()}${projectContext}`
}

/**
 * The kickoff prompt that drives ONE v0 run end-to-end. v0 is deliberately a
 * single flow in the lead session (no sub-agent fan-out): explore → catalog →
 * drive the top flow → write spec → verify green → return JSON.
 */
export const buildQaKickoff = (cfg: QaConfig): string => {
  const baseUrl = cfg.target
    ? `The target under test is ${cfg.target} — use it as the base URL.`
    : `No target URL was given. Detect how to boot the app (e.g. a "dev" script in package.json), start it
in the background with \`setsid nohup npm run dev >/tmp/dev.log 2>&1 & disown\`, and poll its port until ready.
Use that local URL as the base.`
  const scope = cfg.scope ? `\nFocus on these areas first: ${cfg.scope}.` : ''

  return `Run an autonomous QA pass on this repository.

1. EXPLORE. Read the README, AGENTS.md, routes, and package.json to infer what the product does and its
   main user flows. ${baseUrl}${scope}

2. CATALOG. Call \`catalog_flows\` with the user flows you found (slug, title, priority, steps, expected
   outcomes). This writes the backlog to e2e/specs/<slug>.md.

3. DRIVE THE TOP FLOW. Pick the single highest-priority flow. Activate the \`chrome-cdp\` skill, launch a
   headless Chrome on a port, and drive the flow end-to-end (nav → fill → click → snap → assert), using
   the accessibility tree to pick role-based locators. Take a screenshot and \`read\` it to confirm state.

4. WRITE THE SPEC. Write a black-box Playwright test to e2e/tests/<slug>.spec.ts using @playwright/test,
   getByRole/getByLabel/getByText locators, and relative page.goto('/...'). It must encode the flow's
   user-visible guarantee.

5. VERIFY. Run \`run_spec\` on the spec. If it fails, fix the SPEC (locators/assertions/waits) and re-run
   until it passes. Only a green spec is acceptable. Tear down the browser when done.

6. FINISH. End your turn with ONLY a JSON object (no prose, no code fences) of the form:
   {"flowsCatalogued": <n>, "drivenFlow": "<slug>", "specPath": "e2e/tests/<slug>.spec.ts",
    "passed": <true|false>, "broken": [{"flow": "<slug>", "reason": "<why>"}],
    "summary": "<one or two sentences>"}
   Report any flow you found broken in "broken" with a concrete reason — do not silently drop it.`
}
