import { createAgent } from '@flue/runtime'
import { local } from '@flue/runtime/node'
import { type QaPayload, resolveQaConfig } from '../qa/config'
import { driverProfile } from '../qa/driver'
import { healerProfile } from '../qa/healer'
import { buildQaInstructions } from '../qa/instructions'
import { createCatalogFlowsTool } from '../tools/catalog-flows'
import { createClassifyFindingTool } from '../tools/classify-finding'
import { createOpenPrTool } from '../tools/open-pull-request'
import { createRunSpecTool } from '../tools/run-spec'

/**
 * Shippie QA lead (depth 0). It explores the repo, catalogs flows, then FANS OUT
 * one `browser-driver` subagent per flow via the built-in `task` tool — each driver
 * owns its own headless Chrome over CDP (the auto-discovered chrome-cdp skill),
 * writes a black-box CDP test, and self-verifies it green with run_spec. The lead
 * then collects the verdicts and, for each BROKEN flow, delegates to a `healer`
 * subagent (a depth-1 sibling of the drivers) that attempts a minimal source fix
 * plus a failing→passing regression test. Finally it classifies every finding with
 * `classify_finding` and opens the right-tier PR(s): a broken-flow PR per healed
 * flow (fix + test), one missing-coverage PR for the green specs, and a refactor-hint
 * PR only when the classifier accepts it. With a single catalogued flow this degrades
 * to one driver task (and one heal task if it is broken). See docs/ambient-qa.md §3.
 */
export default createAgent<QaPayload>(async ({ payload, env }) => {
  const cfg = resolveQaConfig(payload, env as NodeJS.ProcessEnv)

  return {
    model: cfg.model, // default anthropic/claude-opus-4-8
    thinkingLevel: cfg.thinkingLevel, // 'high'
    sandbox: local({
      cwd: cfg.workspace,
      // local() env is an ALLOWLIST SNAPSHOT — CHROME_BIN must be passed explicitly
      // so the agent's bash can launch the right browser. CDP_IGNORE_CERT_ERRORS lets
      // the agent + tests load external HTTPS behind TLS-inspecting proxies / self-signed.
      env: { CHROME_BIN: cfg.chromeBin, CDP_IGNORE_CERT_ERRORS: '1', CI: '1' },
    }),
    cwd: cfg.workspace, // .agents/skills/chrome-cdp is materialized here at run start
    instructions: await buildQaInstructions(cfg),
    tools: [
      createCatalogFlowsTool(cfg),
      createRunSpecTool(cfg),
      createClassifyFindingTool(cfg),
      createOpenPrTool(cfg),
    ],
    // The subagents the lead fans out to via `task` — depth-1 siblings. `driverProfile`
    // resolves cfg.kind to the ONE matching driver: browser-driver for kind 'web' (its
    // own headless Chrome, writes + verifies a .cdp.mjs spec) or cli-driver for kind
    // 'cli' (runs the target CLI via bash, writes + verifies a .cli.mjs spec) — the
    // kind-branched instructions/kickoff address it by that same name. healer is one
    // per broken flow (minimal source fix + failing→passing regression test, kind-aware).
    subagents: [driverProfile(cfg), healerProfile(cfg)],
    compaction: { keepRecentTokens: 6000 }, // screenshots are heavy in context
    // Size BELOW the GitHub Actions job ceiling (hosted runners cap at 6h).
    durability: { timeoutMs: 75 * 60_000 },
  }
})
