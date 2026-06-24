import { createAgent } from '@flue/runtime'
import { local } from '@flue/runtime/node'
import { type QaPayload, resolveQaConfig } from '../qa/config'
import { buildQaInstructions } from '../qa/instructions'
import { createCatalogFlowsTool } from '../tools/catalog-flows'
import { createOpenPrTool } from '../tools/open-pull-request'
import { createRunSpecTool } from '../tools/run-spec'
import { browserDriverProfile } from '../qa/browser-driver'

/**
 * Shippie QA lead (depth 0). It explores the repo, catalogs flows, then FANS OUT
 * one `browser-driver` subagent per flow via the built-in `task` tool — each driver
 * owns its own headless Chrome over CDP (the auto-discovered chrome-cdp skill),
 * writes a black-box CDP test, and self-verifies it green with run_spec. The lead
 * collects the verdicts and opens one missing-coverage PR. With a single catalogued
 * flow this degrades to exactly one driver task. See docs/ambient-qa.md §3.
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
    tools: [createCatalogFlowsTool(cfg), createRunSpecTool(cfg), createOpenPrTool(cfg)],
    // The per-flow drivers the lead fans out to via `task`. The profile carries its
    // own instructions + run_spec tool; chrome-cdp auto-discovers from the shared cwd.
    subagents: [browserDriverProfile(cfg)],
    compaction: { keepRecentTokens: 6000 }, // screenshots are heavy in context
    // Size BELOW the GitHub Actions job ceiling (hosted runners cap at 6h).
    durability: { timeoutMs: 75 * 60_000 },
  }
})
