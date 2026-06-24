import { createAgent } from '@flue/runtime'
import { local } from '@flue/runtime/node'
import { type QaPayload, resolveQaConfig } from '../qa/config'
import { buildQaInstructions } from '../qa/instructions'
import { createCatalogFlowsTool } from '../tools/catalog-flows'
import { createOpenPrTool } from '../tools/open-pull-request'
import { createRunSpecTool } from '../tools/run-spec'

/**
 * Shippie QA lead. v0 is a SINGLE non-subagent lead: it explores the repo,
 * catalogs flows, drives the top flow in a headless Chrome over CDP (the
 * auto-discovered chrome-cdp skill), writes a black-box Playwright spec, and
 * self-verifies it green with run_spec — all in its own session. Fan-out via
 * `task` + a browser-driver subagent profile is phase 1 (see docs/ambient-qa.md).
 */
export default createAgent<QaPayload>(async ({ payload, env }) => {
  const cfg = resolveQaConfig(payload, env as NodeJS.ProcessEnv)

  return {
    model: cfg.model, // default anthropic/claude-opus-4-8
    thinkingLevel: cfg.thinkingLevel, // 'high'
    sandbox: local({
      cwd: cfg.workspace,
      // local() env is an ALLOWLIST SNAPSHOT — CHROME_BIN must be passed explicitly
      // so the agent's bash can launch the right browser.
      env: { CHROME_BIN: cfg.chromeBin, CI: '1' },
    }),
    cwd: cfg.workspace, // .agents/skills/chrome-cdp is materialized here at run start
    instructions: await buildQaInstructions(cfg),
    tools: [createCatalogFlowsTool(cfg), createRunSpecTool(cfg), createOpenPrTool(cfg)],
    compaction: { keepRecentTokens: 6000 }, // screenshots are heavy in context
    // Size BELOW the GitHub Actions job ceiling (hosted runners cap at 6h).
    durability: { timeoutMs: 75 * 60_000 },
  }
})
